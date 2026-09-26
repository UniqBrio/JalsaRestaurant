# Jalsa Print Bridge for Windows — install and set up

> **Who this is for:** the owner, or whoever sets up the counter or kitchen computer.
> **What you need:** the Windows computer the thermal printer is plugged into, the printer switched
> on with paper, and a phone or laptop signed in to the Jalsa owner console.
>
> Every label in **bold** below is the exact wording on the Jalsa screen or in the installer. The
> screens are drawn in `Design planning documentation/Jalsa Print Setup.dc.html`. This repository
> holds no screenshots of a real Windows run yet (KL-7), so none are reproduced here.

---

## 1. Download the zip

1. On the Windows computer, open Jalsa in the browser and sign in to the owner console.
2. Go to **Printers** and press **Connect Printing Computer**.
3. In the sheet **Connect your printing computer**, step **1 · Download Jalsa Print Bridge**, press
   **Download for Windows**.
4. The file saved is **`jalsa-print-bridge-windows.zip`** (about 37 MB), normally in the
   **Downloads** folder.

If the sheet says the installer is not published, the Jalsa server has not been given the
download yet — see `docs/registers/ENVIRONMENTS.md`, "Publishing the Windows installer".

## 2. Extract the zip

1. Open **Downloads**, right-click **`jalsa-print-bridge-windows.zip`** → **Extract All…** →
   **Extract**.
2. Open the extracted folder. It contains:

   | File | What it is |
   |---|---|
   | `Install Jalsa Print Bridge.cmd` | the installer — the only thing you double-click |
   | `Remove Jalsa Print Bridge.cmd` | removes the bridge from this computer |
   | `README.txt` | these steps, short |
   | `main.js`, `node\node.exe` | the bridge and the runtime it needs (nothing else to install) |
   | `jalsa.json` | which Jalsa server this download belongs to — never edit it |
   | `install.ps1`, `uninstall.ps1` | what the two `.cmd` files run, readable in full |

Do **not** run the installer from inside the zip without extracting it: Windows runs it from a
temporary folder and the installer reports the download as incomplete.

## 3. Run the installer as Administrator

1. Double-click **`Install Jalsa Print Bridge.cmd`**.
2. Windows asks **"Do you want to allow this app to make changes to your device?"** — choose
   **Yes**. The `.cmd` requests Administrator rights itself ("Run as administrator"); you do not
   need to right-click.
   - If you opened `install.ps1` directly, or chose **No**, the installer stops with
     **Please run "Install Jalsa Print Bridge.cmd" - it asks Windows for the permission this
     needs.** Double-click the `.cmd` again and choose **Yes**.
   - On a computer where your Windows account is not an administrator, an administrator's
     password is asked for at this point.
3. A blue PowerShell window opens with the heading **Jalsa Print Bridge**.

What the installer does (you type nothing except the pairing code):

- copies the bridge into `%ProgramData%\Jalsa\PrintBridge\app` and keeps its settings, spool and
  logs beside it in `%ProgramData%\Jalsa\PrintBridge` (readable only by Windows and
  administrators);
- asks for the pairing code once (step 4);
- registers a Windows **Scheduled Task** named **Jalsa Print Bridge** that starts with Windows and
  restarts itself if it stops — there is nothing to run in the morning;
- waits up to 30 seconds for the bridge to report **Connected**.

## 4. Pair the computer (the pairing code)

1. Back in Jalsa, the same sheet shows step **3 · Pair this computer** with a code of **8
   characters**. It works **once** and for **10 minutes**.
2. In the installer window, at **Type the pairing code**, type that code and press **Enter**.
3. The installer says **Connected. Go back to Jalsa -> Printers: this computer and its printers
   are listed there.** The Jalsa sheet changes from **Waiting for … to connect…** and its button
   becomes **Choose the printer**.

If the code expired (**That code has expired. Get a new one.**), press **Get a new code** in
Jalsa and type the new one. After five failed tries the installer stops with **Pairing did not
succeed. Get a fresh code in Jalsa -> Printers and run the installer again.**

## 5. Select the printer in Jalsa and connect it

1. On **Printers**, the computer is listed with the printers Windows found on it
   (**Available**, **Offline**, **Needs attention**).
2. Beside the thermal printer (for example `TVS RP3160 Gold`), press **Select**.
3. In **Set up this printer**, under **Use it as**, choose:
   - **A new printer** — give it a **Printer name**, a **Station** (Main Kitchen, Tandoor,
     Billing, or type your own) and what it prints (**Kitchen tickets** or **Bills**); or
   - a printer **already in Jalsa**, to keep its name, station and routes.
4. Press **Save Printer**.
5. On the printer's card press **Test Print**. The line under it follows the test ticket until it
   says **Test print completed**.

## 6. Change the printer

To make a Windows printer print as a different Jalsa printer, or to move a Jalsa printer onto
another Windows printer or computer:

1. **Printers** → find the Windows printer (it shows **→ Station · Name**) → **Change**.
2. Choose the Jalsa printer it should print as. A printer already on another computer is marked
   **now on … — moves here**; choosing it moves it.
3. **Save Printer**, then **Test Print**.

One Windows printer prints as exactly one Jalsa printer, and one Jalsa printer is on exactly one
computer — saving replaces the old choice rather than printing tickets twice.

## 7. Deselect a printer (stop using it)

- **Printers** → the Windows printer → **Stop using**, or the printer's card → **Remove**.
  The Jalsa printer, its station and its routes are kept; it simply is not on a computer until
  you **Select** it again. Its tickets fall back to the main kitchen printer meanwhile.
- To delete a Jalsa printer entirely: **Printers** → **Manage** → **Printers** tab → the printer
  → **Configure** → **Delete** → **Delete printer**. Deleting is refused while tickets are still
  waiting on it — reprint those to another printer from **History** first. Past tickets keep its
  name in History.
- To switch a printer off without removing it: **Configure** → turn off **Use this machine** →
  **Save changes**. Its tickets go to the main kitchen printer.

## 8. Troubleshooting

| What you see | What to do |
|---|---|
| The computer does not appear in **Printers** a minute after installing | Open `%ProgramData%\Jalsa\PrintBridge\logs\bridge.log` and send it to whoever supports your Jalsa. Check the computer has internet. |
| **This download is incomplete (… is missing)** | The zip was not extracted, or was blocked by antivirus. Download it again and use **Extract All…**. |
| The printer is listed as **Offline** | Switch the printer on, check the USB cable, and check it prints a Windows test page (Settings → Printers & scanners). |
| **Not on a computer** on a printer card | It was removed or its computer was disconnected. **Select** it again under the computer. |
| **Test Print** stays waiting | The bridge is not running: restart the computer, or in Task Scheduler run **Jalsa Print Bridge**. |
| The computer shows as not connected after it was disconnected in Jalsa | A disconnected computer cannot reconnect with its old credential. Run the installer again and pair with a new code. |

## 9. Uninstall

1. In the extracted folder, double-click **`Remove Jalsa Print Bridge.cmd`** and choose **Yes**
   when Windows asks. It stops and deletes the **Jalsa Print Bridge** task and removes
   `%ProgramData%\Jalsa\PrintBridge`, including this computer's credential.
2. In Jalsa → **Printers**, press **Disconnect** on that computer and confirm **Disconnect the
   computer**, so tickets stop waiting for it. Its printers are taken off it and fall back to the
   main kitchen printer until they are selected on another computer.
