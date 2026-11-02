param([Parameter(Mandatory = $true)][string]$PayloadPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName PresentationCore
$alarmPayload = Get-Content -LiteralPath $PayloadPath -Raw -Encoding UTF8 | ConvertFrom-Json
$alarmJobs = @($alarmPayload.jobs)
$alarmIds = @($alarmJobs | ForEach-Object { $_.id })
$activeStatusUrl = $alarmPayload.api + '/alarms/active?ids=' + [Uri]::EscapeDataString(($alarmIds -join ','))
$isPreview = $alarmIds -contains 'preview'
$isTestAlarm = ($alarmIds -contains 'test') -or $isPreview
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
    $alarmSnapshot = Invoke-RestMethod -Uri $activeStatusUrl -TimeoutSec 3
    $alarmBody = @{ action = $action; ids = $alarmIds; expected_revision = $alarmSnapshot.revision } | ConvertTo-Json -Compress
    $null = Invoke-RestMethod -Uri "$($alarmPayload.api)/alarms" -Method Post -ContentType 'application/json' -Body $alarmBody -TimeoutSec 3
    $script:alarmAcknowledged = $true
}
foreach ($label in @('Open terminal', 'Copy prompt', 'Stop sound', 'Snooze 5 min', 'Dismiss')) {
    $alarmButton = New-Object System.Windows.Forms.Button
    $alarmButton.Text = $label
    $alarmButton.AutoSize = $true
    $alarmButton.Add_Click({
        try {
            switch ($this.Text) {
                'Open terminal' { Start-Process $alarmPayload.terminal }
                'Copy prompt' { [System.Windows.Forms.Clipboard]::SetText(($alarmJobs.prompt -join "`r`n`r`n")) }
                'Snooze 5 min' { Send-AlarmAction 'snooze'; $alarmWindow.Close() }
                'Stop sound' { Stop-AlarmAudio; if (-not $isTestAlarm) { Send-AlarmAction 'silence'; $script:alarmAcknowledged = $false } }
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
$script:alarmPlayer = New-Object System.Windows.Media.MediaPlayer
$script:audioActive = $false
$script:audioSilenced = $false
$script:audioClock = [System.Diagnostics.Stopwatch]::new()
$script:repeatAt = 0
$script:alarmAudio = $alarmPayload.audio
function Stop-AlarmAudio {
    $script:audioActive = $false
    $script:audioSilenced = $true
    $script:alarmPlayer.Stop()
}
function Start-AlarmAudio {
    if ($script:audioSilenced -or -not $script:alarmAudio.enabled -or $script:alarmAudio.volume -le 0) { return }
    $script:alarmPlayer.Volume = $script:alarmAudio.volume / 100.0
    $script:alarmPlayer.Position = [TimeSpan]::Zero
    $script:audioActive = $true
    $script:audioClock.Restart()
    $script:alarmPlayer.Play()
}
$script:alarmPlayer.Open([Uri]$alarmPayload.audio_path)
$script:alarmPlayer.Add_MediaEnded({
    if ($script:audioActive -and $script:audioClock.Elapsed.TotalSeconds -lt $script:alarmAudio.duration) {
        $script:alarmPlayer.Position = [TimeSpan]::Zero
        $script:alarmPlayer.Play()
    }
})
$script:alarmPlayer.Add_MediaFailed({
    $script:audioActive = $false
    $script:audioSilenced = $true
    $alarmText.Text += "`r`nAudio playback failed. Choose another sound in Alarm Settings."
})
$alarmSoundTimer = New-Object System.Windows.Forms.Timer
$alarmSoundTimer.Interval = 100
$alarmSoundTimer.Add_Tick({
    if ($isPreview -and $script:audioClock.Elapsed.TotalSeconds -ge $script:alarmAudio.duration) { $alarmWindow.Close(); return }
    if ($script:audioActive -and $script:audioClock.Elapsed.TotalSeconds -ge $script:alarmAudio.duration) {
        $script:alarmPlayer.Stop(); $script:audioActive = $false
        $script:repeatAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + 10000
    }
    if (-not $script:audioActive -and $script:alarmAudio.repeat -and -not $isPreview -and -not $script:audioSilenced -and [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -ge $script:repeatAt) { Start-AlarmAudio }
})
$alarmPollTimer = New-Object System.Windows.Forms.Timer
$alarmPollTimer.Interval = 2000
$alarmPollTimer.Add_Tick({
    if ($isTestAlarm) { return }
    try {
        $alarmSnapshot = Invoke-RestMethod -Uri $activeStatusUrl -TimeoutSec 1
        $stillRinging = @($alarmSnapshot.jobs | Where-Object { $_.id -in $alarmIds -and $_.status -eq 'ringing' })
        $script:alarmAudio = $alarmSnapshot.audio
        $script:alarmPlayer.Volume = $script:alarmAudio.volume / 100.0
        if (-not $script:alarmAudio.enabled -or @($stillRinging | Where-Object { -not $_.silenced }).Count -eq 0) { Stop-AlarmAudio }
        if ($stillRinging.Count -eq 0) { $script:alarmAcknowledged = $true; $alarmWindow.Close() }
    } catch { # Keep the alarm visible if the local worker is temporarily unavailable.
    }
})
$alarmWindow.Add_Shown({
    $script:audioClock.Start()
    Start-AlarmAudio
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
finally { $script:alarmPlayer.Stop(); $script:alarmPlayer.Close(); $alarmSoundTimer.Dispose(); $alarmPollTimer.Dispose(); $alarmWindow.Dispose() }
