@echo off
rem Jalsa Print Bridge - double-click to remove it from this PC.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -NoExit -File \"%~dp0uninstall.ps1\"'"
