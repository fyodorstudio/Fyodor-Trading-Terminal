param([switch]$Restart)

$ErrorActionPreference = 'Stop'

function Get-FyodorPhoneOwner([int]$Port) {
    $owners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique)
    if ($owners.Count -gt 1) { throw "Port $Port has multiple owners; no process was stopped." }
    if ($owners.Count -eq 1) { return $owners[0] }
}

function Assert-FyodorPhoneProcess($OwnerId, $Runtime) {
    $worker = Get-CimInstance Win32_Process -Filter "ProcessId = $OwnerId"
    $pattern = '(?i)(?:^|\s)-m\s+storage\.news_flow\.phone\s*$'
    if (!$worker -or $worker.CommandLine -notmatch $pattern) { throw 'Port 8005 is not a verified Fyodor phone reader; no process was stopped.' }
    if ($worker.ExecutablePath -eq $Runtime) { return $worker }
    $parent = Get-CimInstance Win32_Process -Filter "ProcessId = $($worker.ParentProcessId)"
    if ($parent -and $parent.ExecutablePath -eq $Runtime -and $parent.CommandLine -match $pattern -and $parent.CreationDate -le $worker.CreationDate) { return $worker }
    throw 'Port 8005 belongs to another checkout; no process was stopped.'
}

function Assert-FyodorNtfyProcess($OwnerId, $PhoneDirectory) {
    $worker = Get-CimInstance Win32_Process -Filter "ProcessId = $OwnerId"
    $binary = Join-Path $PhoneDirectory 'ntfy-2.38.0\ntfy.exe'
    $configuration = Join-Path $PhoneDirectory 'server.yml'
    if (!$worker -or $worker.ExecutablePath -ne $binary -or
        $worker.CommandLine -notmatch ('(?i)serve\s+--config\s+"?' + [regex]::Escape($configuration) + '"?\s*$')) {
        throw 'Port 8004 is not this checkout''s verified ntfy server; no process was stopped.'
    }
    return $worker
}

function Initialize-FyodorPhoneFirewall($Root) {
    $rule = 'Fyodor-News-Phone-LAN'
    try {
        $network = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway } | Select-Object -First 1
        $address = @($network.IPv4Address.IPAddress)[0]
        if (!$address -or !$network.InterfaceAlias) { throw 'No routed LAN interface found' }
        if (Get-NetFirewallRule -Name $rule -ErrorAction SilentlyContinue) {
            Set-NetFirewallRule -Name $rule -Enabled True -Direction Inbound -Action Allow -Profile Any `
                -Protocol TCP -LocalPort 8004,8005 -RemoteAddress LocalSubnet -LocalAddress $address `
                -InterfaceAlias $network.InterfaceAlias | Out-Null
        } else {
            New-NetFirewallRule -Name $rule -DisplayName 'Fyodor News phone (local subnet)' `
                -Description "Local news reader and ntfy from $Root" -Direction Inbound -Action Allow `
                -Protocol TCP -LocalPort 8004,8005 -RemoteAddress LocalSubnet -Profile Any `
                -LocalAddress $address -InterfaceAlias $network.InterfaceAlias | Out-Null
        }
    } catch {
        Write-Warning 'Phone firewall rule could not be installed. If the phone cannot connect, run pnpm news:phone once in an Administrator terminal. Access is limited to the routed interface, local address and local subnet.'
    }
}

function Invoke-FyodorNewsPhone($Root, [switch]$Restart) {
    $runtime = Join-Path $Root 'bridge\.venv\Scripts\python.exe'
    $data = if ($env:FYODOR_STORAGE_DATA_DIR) { [IO.Path]::GetFullPath($env:FYODOR_STORAGE_DATA_DIR) } else { Join-Path $Root 'storage\data' }
    $phoneDirectory = Join-Path $data 'news-flow\phone'
    $ownerId = Get-FyodorPhoneOwner 8005
    $ntfyOwner = Get-FyodorPhoneOwner 8004
    # Validate both listeners before stopping either one.
    $worker = if ($ownerId) { Assert-FyodorPhoneProcess $ownerId $runtime }
    $ntfy = if ($ntfyOwner) { Assert-FyodorNtfyProcess $ntfyOwner $phoneDirectory }
    if ($worker) {
        $health = $null
        try { $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8005/health' -TimeoutSec 2 } catch { }
        if ($health -and ($health.application -ne 'fyodor-news-phone' -or $health.data_directory -ne $phoneDirectory)) {
            throw 'Phone listener reports another application or data directory; no process was stopped.'
        }
    }
    if ($ownerId -and !$Restart) {
        $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8005/health' -TimeoutSec 2
        if ($health.application -ne 'fyodor-news-phone' -or $health.data_directory -ne $phoneDirectory -or !$ntfyOwner) {
            throw 'Phone service is incomplete or belongs to another data directory. Run pnpm news:phone:restart.'
        }
        Initialize-FyodorPhoneFirewall $Root
        Write-Output 'Fyodor phone reader and private ntfy are already running.'
        return
    }
    if ($worker) {
        $current = Assert-FyodorPhoneProcess $ownerId $runtime
        if ((Get-FyodorPhoneOwner 8005) -ne $ownerId -or $current.CreationDate -ne $worker.CreationDate) { throw 'Phone worker changed during restart; retry dev:all.' }
        Stop-Process -Id $ownerId -Force
    }
    if ($ntfy -and (Get-FyodorPhoneOwner 8004)) {
        $current = Assert-FyodorNtfyProcess $ntfyOwner $phoneDirectory
        if ((Get-FyodorPhoneOwner 8004) -ne $ntfyOwner -or $current.CreationDate -ne $ntfy.CreationDate) { throw 'ntfy changed during restart; retry dev:all.' }
        Stop-Process -Id $ntfyOwner -Force
    }
    New-Item -ItemType Directory -Force -Path $phoneDirectory | Out-Null
    Initialize-FyodorPhoneFirewall $Root
    $process = Start-Process -FilePath $runtime -ArgumentList @('-m', 'storage.news_flow.phone') -WorkingDirectory $Root `
        -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $phoneDirectory 'worker.log') `
        -RedirectStandardError (Join-Path $phoneDirectory 'worker-error.log')
    # First start may download the pinned official ntfy binary. Each health call
    # is bounded; no other terminal service is required to start this reader.
    for ($attempt = 0; $attempt -lt 180; $attempt++) {
        Start-Sleep -Milliseconds 500
        try {
            $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8005/health' -TimeoutSec 1
            $newOwner = Get-FyodorPhoneOwner 8005
            $newWorker = Assert-FyodorPhoneProcess $newOwner $runtime
            if ($health.application -eq 'fyodor-news-phone' -and $health.data_directory -eq $phoneDirectory -and
                ($newWorker.ProcessId -eq $process.Id -or $newWorker.ParentProcessId -eq $process.Id)) {
                Write-Output 'Fyodor phone reader and private ntfy ready. Open the News Flow bell for the phone address, topic and reader login.'
                return
            }
        } catch { }
        if ($process.HasExited) { break }
    }
    throw 'Phone service did not start. See storage/data/news-flow/phone/worker-error.log. Saved news is preserved.'
}

if ($MyInvocation.InvocationName -ne '.') {
    Invoke-FyodorNewsPhone -Root (Resolve-Path (Join-Path $PSScriptRoot '..')).Path -Restart:$Restart
}
