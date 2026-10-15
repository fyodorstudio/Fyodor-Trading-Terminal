$ErrorActionPreference = 'Stop'
$alarmRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$alarmUri = 'http://127.0.0.1:8003/alarms'
try {
    $alarmHealth = Invoke-RestMethod -Uri $alarmUri -TimeoutSec 2
    if ($alarmHealth.application -ne 'fyodor-alarms') { throw 'Port 8003 belongs to another application.' }
    Write-Output 'Fyodor alarm worker is already running.'
    exit 0
} catch {
    if (Get-NetTCPConnection -LocalPort 8003 -State Listen -ErrorAction SilentlyContinue) {
        throw 'Port 8003 is occupied; no process was stopped. Inspect it before starting alarms.'
    }
}
$alarmRuntime = Join-Path $alarmRoot 'bridge\.venv\Scripts\python.exe'
$alarmLogDirectory = Join-Path $alarmRoot 'storage\data\alarms'
New-Item -ItemType Directory -Force -Path $alarmLogDirectory | Out-Null
$alarmProcess = Start-Process -FilePath $alarmRuntime -ArgumentList @('-m', 'storage.alarm_service') -WorkingDirectory $alarmRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $alarmLogDirectory 'worker.log') -RedirectStandardError (Join-Path $alarmLogDirectory 'worker-error.log')
for ($alarmAttempt = 0; $alarmAttempt -lt 20; $alarmAttempt++) {
    Start-Sleep -Milliseconds 250
    try {
        $alarmHealth = Invoke-RestMethod -Uri $alarmUri -TimeoutSec 1
        if ($alarmHealth.application -eq 'fyodor-alarms') {
            Write-Output "Fyodor alarm worker started (PID $($alarmProcess.Id)). Browser may close; keep Windows awake."
            exit 0
        }
    } catch { }
    if ($alarmProcess.HasExited) { break }
}
throw 'Alarm worker did not start. See storage/data/alarms/worker-error.log; existing services were left running.'
