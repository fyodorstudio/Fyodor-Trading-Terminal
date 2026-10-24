$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\start-alarms.ps1')

$testRoot = 'C:\fixture\Lite'
$testRuntime = Join-Path $testRoot 'bridge\.venv\Scripts\python.exe'
$testSources = Join-Path $testRoot 'Market Analyst Workflow\external-sources'

function Assert($Condition, $Message) {
    if (!$Condition) { throw "Assertion failed: $Message" }
}
function Assert-Fails($Action, $Pattern) {
    try { & $Action | Out-Null } catch {
        Assert ($_.Exception.Message -match $Pattern) "Expected '$Pattern', got: $_"
        return
    }
    throw "Expected failure: $Pattern"
}
function Reset-Fixture {
    $script:owner = 41
    $script:starts = 0
    $script:stops = @()
    $script:pauses = 0
    $script:keepPort = $false
    $script:unresponsive = $false
    $script:oldSchema = $false
    $script:changedIdentity = $false
    $script:identityReads = 0
    $script:health = @{ application = 'fyodor-alarms' }
    $script:processes = @{
        41 = [pscustomobject]@{ ProcessId = 41; ParentProcessId = 40; ExecutablePath = 'C:\Python\python.exe'; CommandLine = 'python.exe -m storage.alarm_service '; CreationDate = 2 }
        40 = [pscustomobject]@{ ProcessId = 40; ParentProcessId = 1; ExecutablePath = $testRuntime; CommandLine = 'python.exe -m storage.alarm_service'; CreationDate = 1 }
    }
}
# All OS boundaries are mocked: no real worker, state file or desktop is touched.
function Get-NetTCPConnection { param($LocalPort, $State, $ErrorAction)
    Assert ($LocalPort -eq 8003 -and $State -eq 'Listen') 'Only the alarm listener is queried'
    if ($script:owner) { [pscustomobject]@{ OwningProcess = $script:owner } }
}
function Get-CimInstance { param($ClassName, $Filter)
    Assert ($ClassName -eq 'Win32_Process') 'Process identity uses CIM'
    $identity = [int]($Filter -replace 'ProcessId = ', '')
    if ($identity -eq 41) {
        $script:identityReads++
        if ($script:changedIdentity -and $script:identityReads -gt 1) {
            return [pscustomobject]@{ ProcessId = 41; ExecutablePath = $testRuntime; CommandLine = 'python -m storage.alarm_service'; CreationDate = 99 }
        }
    }
    return $script:processes[$identity]
}
function Invoke-RestMethod { param($Uri, $TimeoutSec)
    Assert ($Uri -eq 'http://127.0.0.1:8003/alarms' -and $TimeoutSec -le 2) 'Bounded loopback health check'
    if ($script:unresponsive) { throw 'Offline' }
    return $script:health
}
function Stop-Process { param($Id, [switch]$Force, $ErrorAction)
    Assert ($Id -eq 41) 'Only the verified socket owner is stopped'
    $script:stops += $Id
    if (!$script:keepPort) { $script:owner = $null }
}
function New-Item { param($ItemType, [switch]$Force, $Path)
    Assert ($Path -eq (Join-Path $testRoot 'storage\data\alarms')) 'Only the existing log directory is ensured'
}
function Start-Process { param($FilePath, $ArgumentList, $WorkingDirectory, $WindowStyle, [switch]$PassThru, $RedirectStandardOutput, $RedirectStandardError)
    Assert (!$script:owner) 'Replacement only starts after the port is free'
    Assert ($FilePath -eq $testRuntime -and $WorkingDirectory -eq $testRoot) 'Worker uses this checkout runtime and directory'
    Assert (($ArgumentList -join ' ') -eq '-m storage.alarm_service') 'Only the alarm module starts'
    Assert ($WindowStyle -eq 'Hidden' -and $PassThru) 'No visible helper window'
    Assert ($RedirectStandardOutput -like '*worker.log' -and $RedirectStandardError -like '*worker-error.log') 'Persistent startup diagnostics'
    $script:starts++
    $script:owner = 51
    $script:processes[51] = [pscustomobject]@{ ProcessId = 51; ParentProcessId = 50; ExecutablePath = $testRuntime; CommandLine = 'python -m storage.alarm_service'; CreationDate = 3 }
    $script:health = @{ application = 'fyodor-alarms'; external_source_schema = $(if ($script:oldSchema) { 2 } else { 3 }); external_source_directory = $testSources }
    return [pscustomobject]@{ Id = 51; HasExited = $false }
}
function Start-Sleep { param($Milliseconds)
    Assert ($Milliseconds -eq 250) 'Polling remains bounded'
    $script:pauses++
}

Reset-Fixture
$result = Invoke-FyodorAlarmWorker $testRoot
Assert ($script:starts -eq 0 -and $script:stops.Count -eq 0 -and $result -match 'already running') 'Standalone start reuses the existing worker'

Reset-Fixture
$result = Invoke-FyodorAlarmWorker $testRoot -Restart
Assert ($script:starts -eq 1 -and $script:stops.Count -eq 1 -and $result[-1] -match 'ready') 'Restart replaces the legacy venv child and verifies readiness'

Reset-Fixture
$script:owner = $null
Invoke-FyodorAlarmWorker $testRoot -Restart | Out-Null
Assert ($script:starts -eq 1 -and $script:stops.Count -eq 0) 'Stopped worker starts without attempting a stop'

Reset-Fixture
$script:unresponsive = $true
Assert-Fails { Invoke-FyodorAlarmWorker $testRoot } 'unresponsive'
Assert ($script:stops.Count -eq 0) 'Standalone start does not silently replace an unhealthy worker'
Assert-Fails { Invoke-FyodorAlarmWorker $testRoot -Restart } 'did not become ready'
Assert ($script:pauses -eq 20 -and $script:starts -eq 1) 'HTTP readiness failure is bounded and never reports success'

Reset-Fixture
$script:processes[41].CommandLine = 'python.exe -m other.service'
Assert-Fails { Invoke-FyodorAlarmWorker $testRoot -Restart } 'not a verified'
Assert ($script:stops.Count -eq 0 -and $script:starts -eq 0) 'Unrelated port owner stays untouched'

Reset-Fixture
$script:processes[40].ExecutablePath = 'C:\other-checkout\python.exe'
Assert-Fails { Invoke-FyodorAlarmWorker $testRoot -Restart } 'does not belong to this checkout'
Assert ($script:stops.Count -eq 0) 'Identical module from another checkout stays untouched'

Reset-Fixture
$script:health.external_source_directory = 'C:\other-checkout\external-sources'
Assert-Fails { Invoke-FyodorAlarmWorker $testRoot -Restart } 'another application or checkout'
Assert ($script:stops.Count -eq 0) 'Conflicting HTTP identity prevents restart'

Reset-Fixture
$script:changedIdentity = $true
Assert-Fails { Invoke-FyodorAlarmWorker $testRoot -Restart } 'changed during restart'
Assert ($script:stops.Count -eq 0) 'Reused PID is not stopped'

Reset-Fixture
$script:keepPort = $true
Assert-Fails { Invoke-FyodorAlarmWorker $testRoot -Restart } 'did not become free'
Assert ($script:pauses -eq 20 -and $script:starts -eq 0) 'Failed stop cannot start a duplicate worker'

Reset-Fixture
$script:oldSchema = $true
Assert-Fails { Invoke-FyodorAlarmWorker $testRoot -Restart } 'did not become ready'
Assert ($script:pauses -eq 20) 'Incompatible replacement cannot report readiness'

Write-Output 'Alarm startup: reuse, restart, stopped worker, identity protection and bounded failures passed.'
