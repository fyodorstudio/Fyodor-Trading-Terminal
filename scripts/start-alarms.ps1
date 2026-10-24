param([switch]$Restart)

$ErrorActionPreference = 'Stop'

function Get-FyodorAlarmListener {
    $owners = @(Get-NetTCPConnection -LocalPort 8003 -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique)
    if ($owners.Count -gt 1) { throw 'Port 8003 has multiple owners; no process was stopped.' }
    if ($owners.Count -eq 1) { return $owners[0] }
}

function Get-FyodorAlarmProcess($OwnerId, $Runtime) {
    $worker = Get-CimInstance Win32_Process -Filter "ProcessId = $OwnerId"
    $modulePattern = '(?i)(?:^|\s)-m\s+storage\.alarm_service\s*$'
    if (!$worker -or $worker.CommandLine -notmatch $modulePattern) {
        throw 'Port 8003 is not a verified Fyodor alarm worker; no process was stopped.'
    }
    if ($worker.ExecutablePath -eq $Runtime) { return $worker }
    # Windows venv python.exe can launch a base-Python child which owns the socket.
    $parent = Get-CimInstance Win32_Process -Filter "ProcessId = $($worker.ParentProcessId)"
    if ($parent -and $parent.ExecutablePath -eq $Runtime -and
        $parent.CommandLine -match $modulePattern -and $parent.CreationDate -le $worker.CreationDate) {
        return $worker
    }
    throw 'Port 8003 does not belong to this checkout; no process was stopped.'
}

function Invoke-FyodorAlarmWorker($Root, [switch]$Restart) {
    $alarmUri = 'http://127.0.0.1:8003/alarms'
    $runtime = Join-Path $Root 'bridge\.venv\Scripts\python.exe'
    $sourceDirectory = Join-Path $Root 'Market Analyst Workflow\external-sources'
    $ownerId = Get-FyodorAlarmListener
    if ($ownerId) {
        $worker = Get-FyodorAlarmProcess $ownerId $runtime
        $health = $null
        try { $health = Invoke-RestMethod -Uri $alarmUri -TimeoutSec 2 } catch { }
        if ($health -and ($health.application -ne 'fyodor-alarms' -or
            ($health.external_source_directory -and $health.external_source_directory -ne $sourceDirectory))) {
            throw 'Port 8003 reports another application or checkout; no process was stopped.'
        }
        if (!$Restart) {
            if (!$health) { throw 'Alarm worker is unresponsive. Run pnpm alarms:restart to reload it.' }
            Write-Output 'Fyodor alarm worker is already running.'
            return
        }
        # Recheck process identity immediately before stopping only the socket owner.
        $current = Get-FyodorAlarmProcess $ownerId $runtime
        if ((Get-FyodorAlarmListener) -ne $ownerId -or $current.CreationDate -ne $worker.CreationDate) {
            throw 'Alarm worker changed during restart; retry dev:all. No process was stopped.'
        }
        Stop-Process -Id $ownerId -Force -ErrorAction Stop
        for ($attempt = 0; $attempt -lt 20; $attempt++) {
            if (!(Get-FyodorAlarmListener)) { break }
            Start-Sleep -Milliseconds 250
        }
        if (Get-FyodorAlarmListener) { throw 'Port 8003 did not become free; replacement worker was not started.' }
        Write-Output "Fyodor alarm worker stopped (PID $ownerId); loading current code."
    }

    $logDirectory = Join-Path $Root 'storage\data\alarms'
    New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
    $process = Start-Process -FilePath $runtime -ArgumentList @('-m', 'storage.alarm_service') -WorkingDirectory $Root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory 'worker.log') -RedirectStandardError (Join-Path $logDirectory 'worker-error.log')
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        Start-Sleep -Milliseconds 250
        try {
            $health = Invoke-RestMethod -Uri $alarmUri -TimeoutSec 1
            $newOwner = Get-FyodorAlarmListener
            $newWorker = Get-FyodorAlarmProcess $newOwner $runtime
            if ($health.application -eq 'fyodor-alarms' -and $health.external_source_schema -ge 3 -and
                $health.external_source_directory -eq $sourceDirectory -and
                ($newWorker.ProcessId -eq $process.Id -or $newWorker.ParentProcessId -eq $process.Id)) {
                Write-Output "Fyodor alarm worker ready (PID $newOwner). Browser may close; keep Windows awake."
                return
            }
        } catch { }
        if ($process.HasExited) { break }
    }
    throw 'Alarm worker did not become ready. See storage/data/alarms/worker-error.log; saved reminder state is preserved.'
}

if ($MyInvocation.InvocationName -ne '.') {
    Invoke-FyodorAlarmWorker -Root (Resolve-Path (Join-Path $PSScriptRoot '..')).Path -Restart:$Restart
}
