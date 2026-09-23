<#
  Jalsa Print Bridge - Windows installer.

  WHAT IT DOES, IN ORDER
    1. Copies the bridge (main.js), its Node runtime (node\node.exe) and this installer's
       jalsa.json into %ProgramData%\Jalsa\PrintBridge\app.
    2. Creates the config, spool and logs folders and locks config to SYSTEM + Administrators.
    3. Asks for the pairing code shown in Jalsa -> Printers, ONCE, and lets the bridge exchange it
       for this computer's credential (node main.js pair). The code is the only thing typed.
    4. Registers a Scheduled Task "Jalsa Print Bridge" that runs `node main.js run` as SYSTEM at
       every startup and restarts it if it stops. No one runs anything in the morning.
    5. Starts it and waits for it to report "connected".

  WHAT IT NEVER DOES
    Print a token, ask for a queue name, ask for a URL, or need Node.js installed on the PC -
    the runtime travels with the bridge.

  Parameters, for whoever runs it by hand:
    -Code ABCD-EFGH     skip the prompt
    -Repair             re-copy files and re-register the task without pairing again
    -RunAsCurrentUser   run the task at this user's logon instead of as SYSTEM at boot
#>
[CmdletBinding()]
param(
  [string]$Code = '',
  [switch]$Repair,
  [switch]$RunAsCurrentUser
)

$ErrorActionPreference = 'Stop'
$TaskName = 'Jalsa Print Bridge'
$Home_ = Join-Path $env:ProgramData 'Jalsa\PrintBridge'
$App = Join-Path $Home_ 'app'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path

function Say($text) { Write-Host $text }
function Fail($text) { Write-Host ''; Write-Host "  $text" -ForegroundColor Red; Write-Host ''; exit 1 }

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Fail 'Please run "Install Jalsa Print Bridge.cmd" - it asks Windows for the permission this needs.' }

Say ''
Say '  Jalsa Print Bridge'
Say '  ------------------'

# -- 1. Files -----------------------------------------------------------------------------
foreach ($required in @('main.js', 'jalsa.json', 'node\node.exe')) {
  if (-not (Test-Path (Join-Path $Here $required))) { Fail "This download is incomplete ($required is missing). Download it again from Jalsa -> Printers." }
}
New-Item -ItemType Directory -Force -Path $App, (Join-Path $App 'node'), (Join-Path $Home_ 'spool'), (Join-Path $Home_ 'logs') | Out-Null

# Stop a running bridge before replacing its files.
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}
Copy-Item (Join-Path $Here 'main.js') (Join-Path $App 'main.js') -Force
Copy-Item (Join-Path $Here 'jalsa.json') (Join-Path $App 'jalsa.json') -Force
Copy-Item (Join-Path $Here 'node\*') (Join-Path $App 'node') -Recurse -Force
$Node = Join-Path $App 'node\node.exe'
$Main = Join-Path $App 'main.js'
Say '  Files installed.'

# -- 2. Lock the folder that will hold the credential -------------------------------------
# Only SYSTEM (the task) and Administrators (the installer) may read it. Ordinary users of this
# PC cannot copy the credential off it.
& icacls $Home_ /inheritance:r /grant:r 'SYSTEM:(OI)(CI)F' 'Administrators:(OI)(CI)F' | Out-Null

# -- 3. Pairing ---------------------------------------------------------------------------
$configPath = Join-Path $Home_ 'config.json'
if ($Repair -and (Test-Path $configPath)) {
  Say '  Keeping the existing connection to Jalsa.'
} else {
  Say ''
  Say '  In Jalsa, open Printers and press "Connect Printing Computer" to see a pairing code.'
  $attempts = 0
  while ($true) {
    $attempts++
    if (-not $Code) { $Code = Read-Host '  Type the pairing code' }
    & $Node $Main pair --code $Code
    $rc = $LASTEXITCODE
    if ($rc -eq 0) { break }
    $Code = ''
    if ($rc -eq 4) { Say '  (Check this computer is online, then try again.)' }
    if ($attempts -ge 5) { Fail 'Pairing did not succeed. Get a fresh code in Jalsa -> Printers and run the installer again.' }
  }
}

# -- 4. The service -----------------------------------------------------------------------
$action = New-ScheduledTaskAction -Execute $Node -Argument "`"$Main`" run" -WorkingDirectory $App
$settings = New-ScheduledTaskSettingsSet `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -MultipleInstances IgnoreNew `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
if ($RunAsCurrentUser) {
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
} else {
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
}
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Carries Jalsa kitchen tickets to the printers on this computer. Installed by Jalsa Print Bridge.' | Out-Null
Start-ScheduledTask -TaskName $TaskName
Say '  Jalsa Print Bridge will start with Windows and restart itself if it stops.'

# -- 5. Wait for it to report in ----------------------------------------------------------
$statePath = Join-Path $Home_ 'state.json'
$connected = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Path $statePath) {
    try {
      $state = Get-Content $statePath -Raw | ConvertFrom-Json
      if ($state.state -eq 'connected') { $connected = $true; break }
    } catch { }
  }
}
Say ''
if ($connected) {
  Say '  Connected. Go back to Jalsa -> Printers: this computer and its printers are listed there.' 
} else {
  Say '  The bridge is installed and starting. If Jalsa -> Printers does not show this computer'
  Say "  within a minute, open $Home_\logs\bridge.log and send it to whoever supports your Jalsa."
}
Say ''
