$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\start-news-phone.ps1')

function Assert($condition, $message) { if (!$condition) { throw "Assertion failed: $message" } }
function Must-Fail($action, $pattern) {
    try { & $action | Out-Null } catch { Assert ($_.Exception.Message -match $pattern) "Expected $pattern, got $_"; return }
    throw "Expected failure: $pattern"
}
$root = 'C:\fixture\Lite'
$runtime = Join-Path $root 'bridge\.venv\Scripts\python.exe'
$directory = Join-Path $root 'storage\data\news-flow\phone'
$script:processes = @{
    41 = [pscustomobject]@{ ProcessId=41; ParentProcessId=40; ExecutablePath='C:\Python\python.exe'; CommandLine='python -m storage.news_flow.phone'; CreationDate=2 }
    40 = [pscustomobject]@{ ProcessId=40; ParentProcessId=1; ExecutablePath=$runtime; CommandLine='python -m storage.news_flow.phone'; CreationDate=1 }
    42 = [pscustomobject]@{ ProcessId=42; ParentProcessId=41; ExecutablePath=(Join-Path $directory 'ntfy-2.38.0\ntfy.exe'); CommandLine=('ntfy.exe serve --config "' + (Join-Path $directory 'server.yml') + '"'); CreationDate=3 }
}
function Get-CimInstance { param($ClassName,$Filter)
    Assert ($ClassName -eq 'Win32_Process') 'Only process identities inspected'
    return $script:processes[[int]($Filter -replace 'ProcessId = ', '')]
}
Assert ((Assert-FyodorPhoneProcess 41 $runtime).ProcessId -eq 41) 'Verified venv child allowed'
Assert ((Assert-FyodorNtfyProcess 42 $directory).ProcessId -eq 42) 'Pinned binary and exact configuration verified'
$script:processes[40].ExecutablePath = 'C:\other\python.exe'
Must-Fail { Assert-FyodorPhoneProcess 41 $runtime } 'another checkout'
$script:processes[40].ExecutablePath = $runtime
$script:processes[41].CommandLine = 'python -m another.module'
Must-Fail { Assert-FyodorPhoneProcess 41 $runtime } 'not a verified'
$script:processes[41].CommandLine = 'python -m storage.news_flow.phone'
$script:processes[42].CommandLine = 'ntfy serve --config C:\other\server.yml'
Must-Fail { Assert-FyodorNtfyProcess 42 $directory } 'not this checkout'

$script:firewall = $null
function Get-NetIPConfiguration { [pscustomobject]@{ IPv4DefaultGateway='router'; IPv4Address=[pscustomobject]@{IPAddress='192.168.1.10'}; InterfaceAlias='Ethernet' } }
function Get-NetFirewallRule { param($Name,$ErrorAction); return $script:firewall }
function New-NetFirewallRule {
    param($Name,$DisplayName,$Description,$Direction,$Action,$Protocol,$LocalPort,$RemoteAddress,$Profile,$LocalAddress,$InterfaceAlias)
    Assert ($Protocol -eq 'TCP' -and ($LocalPort -join ',') -eq '8004,8005') 'Only news phone ports opened'
    Assert ($RemoteAddress -eq 'LocalSubnet' -and $LocalAddress -eq '192.168.1.10' -and $InterfaceAlias -eq 'Ethernet') 'Scoped to the routed LAN; no global firewall or network-profile change'
    $script:firewall = @{Name=$Name}
}
Initialize-FyodorPhoneFirewall $root
Assert ($script:firewall.Name -eq 'Fyodor-News-Phone-LAN') 'Private server rule created'

Write-Output 'News phone startup: verified process ownership, foreign config rejection and scoped LAN firewall passed.'
