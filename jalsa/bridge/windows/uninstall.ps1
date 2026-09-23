<#
  Jalsa Print Bridge - remove it from this PC.
  Stops and deletes the Scheduled Task and removes %ProgramData%\Jalsa\PrintBridge, including the
  computer's credential. The computer stays listed in Jalsa until it is disconnected there too.
#>
$ErrorActionPreference = 'SilentlyContinue'
$TaskName = 'Jalsa Print Bridge'
$Home_ = Join-Path $env:ProgramData 'Jalsa\PrintBridge'
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Write-Host 'Please run "Remove Jalsa Print Bridge.cmd" instead.' -ForegroundColor Red; exit 1 }
Stop-ScheduledTask -TaskName $TaskName
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Start-Sleep -Seconds 2
Remove-Item -Recurse -Force $Home_
Write-Host ''
Write-Host '  Jalsa Print Bridge has been removed from this computer.'
Write-Host '  In Jalsa -> Printers, use Disconnect on this computer so tickets stop waiting for it.'
Write-Host ''
