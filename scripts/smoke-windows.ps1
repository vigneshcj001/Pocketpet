# Run after installing PocketPet in an interactive Windows desktop session.
# Uses global shortcuts and Windows UI Automation to verify both webviews load.
param([string]$ExpectedVersion = '')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName UIAutomationClient

$processes = @(Get-Process -Name pocketpet -ErrorAction SilentlyContinue)
if (-not $processes) { throw 'PocketPet is not running. Start installed app first.' }
$ids = @($processes | ForEach-Object Id)
$root = [System.Windows.Automation.AutomationElement]::RootElement

function Wait-PocketPetWindow([string]$title) {
    $until = (Get-Date).AddSeconds(15)
    do {
        $windows = $root.FindAll([System.Windows.Automation.TreeScope]::Children,
            [System.Windows.Automation.Condition]::TrueCondition)
        foreach ($window in $windows) {
            if ($window.Current.Name -eq $title -and $ids -contains $window.Current.ProcessId) {
                return $window
            }
        }
        Start-Sleep -Milliseconds 250
    } while ((Get-Date) -lt $until)
    throw "$title did not open."
}

function Assert-Control([System.Windows.Automation.AutomationElement]$window, [string]$name) {
    $condition = New-Object System.Windows.Automation.PropertyCondition `
        ([System.Windows.Automation.AutomationElement]::NameProperty, $name)
    $until = (Get-Date).AddSeconds(20)
    do {
        $control = $window.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
        if ($control) { return $control }
        Start-Sleep -Milliseconds 250
    } while ((Get-Date) -lt $until)
    $names = @($window.FindAll([System.Windows.Automation.TreeScope]::Descendants,
        [System.Windows.Automation.Condition]::TrueCondition) | ForEach-Object { $_.Current.Name } |
        Where-Object { $_ } | Select-Object -First 15)
    throw "Missing accessible control '$name' in $($window.Current.Name). Found: $($names -join ', ')"
}

[System.Windows.Forms.SendKeys]::SendWait('^%s')
$settings = Wait-PocketPetWindow 'PocketPet settings'
$null = Assert-Control $settings 'General'
$null = Assert-Control $settings 'Backup'
if ($ExpectedVersion) {
    $about = Assert-Control $settings 'About & updates'
    $about.SetFocus()
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
    $until = (Get-Date).AddSeconds(20)
    do {
        $all = $settings.FindAll([System.Windows.Automation.TreeScope]::Descendants,
            [System.Windows.Automation.Condition]::TrueCondition)
        if (@($all | Where-Object { $_.Current.Name -match "PocketPet $([regex]::Escape($ExpectedVersion))" }).Count) { break }
        Start-Sleep -Milliseconds 250
    } while ((Get-Date) -lt $until)
    if ((Get-Date) -ge $until) {
        $visible = @($all | ForEach-Object { $_.Current.Name } | Where-Object { $_ -match 'PocketPet|build|Loading' } | Select-Object -First 12)
        throw "Installed build identity did not show PocketPet $ExpectedVersion. Found: $($visible -join ', ')"
    }
}
[System.Windows.Forms.SendKeys]::SendWait('^%t')
$tasks = Wait-PocketPetWindow 'PocketPet tasks'
$null = Assert-Control $tasks 'Task'
$null = Assert-Control $tasks 'Schedules'
Write-Host 'PocketPet Windows UI smoke passed: Settings and Tasks opened with accessible tabs.'
