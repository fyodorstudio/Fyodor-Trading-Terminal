param([Parameter(Mandatory = $true)][string]$PayloadPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$alarmPayload = Get-Content -LiteralPath $PayloadPath -Raw -Encoding UTF8 | ConvertFrom-Json
$alarmJobs = @($alarmPayload.jobs)
$alarmIds = @($alarmJobs | ForEach-Object { $_.id })
$isTestAlarm = $alarmIds -contains 'test'
$alarmWindow = New-Object System.Windows.Forms.Form
$alarmWindow.Text = 'Fyodor - Events & Alarms'
$alarmWindow.Size = New-Object System.Drawing.Size(620, 380)
$alarmWindow.MinimumSize = $alarmWindow.Size
$alarmWindow.StartPosition = 'CenterScreen'
$alarmWindow.TopMost = $true
$alarmWindow.Font = New-Object System.Drawing.Font('Segoe UI', 11)
$alarmText = New-Object System.Windows.Forms.TextBox
$alarmText.Multiline = $true
$alarmText.ReadOnly = $true
$alarmText.ScrollBars = 'Vertical'
$alarmText.Dock = 'Fill'
$alarmText.Text = ($alarmJobs | ForEach-Object {
    $jakartaTime = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$_.at).ToOffset([TimeSpan]::FromHours(7)).ToString('MMM d, yyyy h:mm tt')
    $instruction = if ($_.stage -eq 'prepare') { 'PREPARE NOW' } elseif ($_.stage -eq 'test') { 'TEST ALARM' } else { 'INVOKE YOUR AGENT NOW' }
    "$instruction`r`n$($_.title)`r`nEvent: $jakartaTime Jakarta`r`n`r`n$($_.prompt)"
}) -join "`r`n`r`n--------------------`r`n`r`n"
$alarmButtons = New-Object System.Windows.Forms.FlowLayoutPanel
$alarmButtons.Dock = 'Bottom'
$alarmButtons.Height = 52
$alarmButtons.Padding = New-Object System.Windows.Forms.Padding(6)
$alarmWindow.Controls.Add($alarmText)
$alarmWindow.Controls.Add($alarmButtons)
$script:alarmAcknowledged = $false
function Send-AlarmAction([string]$action) {
    if ($isTestAlarm) { $script:alarmAcknowledged = $true; return }
    $alarmSnapshot = Invoke-RestMethod -Uri "$($alarmPayload.api)/alarms" -TimeoutSec 3
    $alarmBody = @{ action = $action; ids = $alarmIds; expected_revision = $alarmSnapshot.revision } | ConvertTo-Json -Compress
    $null = Invoke-RestMethod -Uri "$($alarmPayload.api)/alarms" -Method Post -ContentType 'application/json' -Body $alarmBody -TimeoutSec 3
    $script:alarmAcknowledged = $true
}
foreach ($label in @('Open terminal', 'Copy prompt', 'Snooze 5 min', 'Dismiss')) {
    $alarmButton = New-Object System.Windows.Forms.Button
    $alarmButton.Text = $label
    $alarmButton.AutoSize = $true
    $alarmButton.Add_Click({
        try {
            switch ($this.Text) {
                'Open terminal' { Start-Process $alarmPayload.terminal }
                'Copy prompt' { [System.Windows.Forms.Clipboard]::SetText(($alarmJobs.prompt -join "`r`n`r`n")) }
                'Snooze 5 min' { Send-AlarmAction 'snooze'; $alarmWindow.Close() }
                'Dismiss' { Send-AlarmAction 'dismiss'; $alarmWindow.Close() }
            }
        } catch {
            [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Alarm action failed') | Out-Null
        }
    })
    if ($label -eq 'Snooze 5 min' -and ($isTestAlarm -or ($alarmJobs | Where-Object { $_.at -le ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + 300000) }))) {
        $alarmButton.Enabled = $false
    }
    $alarmButtons.Controls.Add($alarmButton)
}
$alarmSoundTimer = New-Object System.Windows.Forms.Timer
$alarmSoundTimer.Interval = 10000
$alarmSoundTimer.Add_Tick({ [System.Media.SystemSounds]::Exclamation.Play() })
$alarmPollTimer = New-Object System.Windows.Forms.Timer
$alarmPollTimer.Interval = 2000
$alarmPollTimer.Add_Tick({
    if ($isTestAlarm) { return }
    try {
        $alarmSnapshot = Invoke-RestMethod -Uri "$($alarmPayload.api)/alarms" -TimeoutSec 1
        $stillRinging = @($alarmSnapshot.jobs | Where-Object { $_.id -in $alarmIds -and $_.status -eq 'ringing' })
        if ($stillRinging.Count -eq 0) { $script:alarmAcknowledged = $true; $alarmWindow.Close() }
    } catch { # Keep the alarm visible if the local worker is temporarily unavailable.
    }
})
$alarmWindow.Add_Shown({
    [System.Media.SystemSounds]::Exclamation.Play()
    $alarmSoundTimer.Start()
    $alarmPollTimer.Start()
})
$alarmWindow.Add_FormClosing({
    if (-not $script:alarmAcknowledged) {
        try { Send-AlarmAction 'dismiss' } catch { # Always allow closing; the worker reports unacknowledged delivery as failed.
        }
    }
})
try { $null = $alarmWindow.ShowDialog() }
finally { $alarmSoundTimer.Dispose(); $alarmPollTimer.Dispose(); $alarmWindow.Dispose() }
