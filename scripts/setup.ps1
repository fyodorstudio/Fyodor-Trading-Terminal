$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $taskRoot
try {
    $taskPythonVersion = python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")'
    if ($LASTEXITCODE -ne 0 -or $taskPythonVersion -ne '3.12') { throw 'Use Windows x64 Python 3.12 for the pinned environment.' }
    if (-not (Test-Path -LiteralPath 'bridge/.venv/Scripts/python.exe')) {
        python -m venv bridge/.venv
        if ($LASTEXITCODE -ne 0) { throw 'Virtual environment creation failed.' }
    }
    $taskVenvVersion = & bridge/.venv/Scripts/python.exe -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")'
    if ($taskVenvVersion -ne '3.12') { throw 'Existing bridge/.venv uses another Python version. Rename it, then rerun setup.' }
    & bridge/.venv/Scripts/python.exe -m pip install --no-deps -r bridge/requirements.lock.txt
    if ($LASTEXITCODE -ne 0) { throw 'Pinned Python dependency installation failed.' }
    & bridge/.venv/Scripts/python.exe -m pip install --no-deps --no-build-isolation -e ./bridge
    if ($LASTEXITCODE -ne 0) { throw 'Local bridge installation failed.' }
    & bridge/.venv/Scripts/python.exe -m pip check
    if ($LASTEXITCODE -ne 0) { throw 'Python dependency verification failed.' }
    pnpm run install:frontend
    if ($LASTEXITCODE -ne 0) { throw 'Frontend installation failed.' }
    Write-Output 'Dependencies installed. Follow docs/SETUP.md for MT5, calendar inventory and configuration.'
} finally { Pop-Location }
