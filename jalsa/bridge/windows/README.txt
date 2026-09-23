Jalsa Print Bridge for Windows
==============================

This folder connects the thermal printer on this computer to Jalsa.

1. Double-click "Install Jalsa Print Bridge.cmd".
2. Windows asks for permission. Choose Yes.
3. When asked, type the pairing code shown in Jalsa under Printers -> Connect Printing Computer.
4. Go back to Jalsa -> Printers, choose the printer and press Test Print.

The bridge starts with Windows from now on. There is nothing to run in the morning.

To remove it, double-click "Remove Jalsa Print Bridge.cmd".

Files:
  main.js        the bridge
  node\node.exe  the runtime it needs (nothing else to install)
  jalsa.json     which Jalsa server this download belongs to
  install.ps1    what the installer does, in full, for anyone who wants to read it
