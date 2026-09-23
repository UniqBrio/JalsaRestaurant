@echo off
rem Jalsa Print Bridge — double-click to install.
rem Asks Windows for permission (the bridge runs as a service for every user of this PC),
rem then runs install.ps1 from this folder. Nothing here needs to be edited.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -NoExit -File \"%~dp0install.ps1\"'"
