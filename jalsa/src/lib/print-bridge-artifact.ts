import 'server-only';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { BRIDGE_PACKAGE_PATH, resolveBridgeDownload, type BridgeDownload } from './print-bridge-download';

/**
 * The server half of `print-bridge-download.ts`: read the environment and the disk, once per ask.
 *
 * `PRINT_BRIDGE_DOWNLOAD_URL` is read directly and not through `serverConfig()`, because it is
 * OPTIONAL — a server without it is a server whose owner is told the installer is not published,
 * not a server that refuses to boot.
 */
export function currentBridgeDownload(): BridgeDownload {
  return resolveBridgeDownload({
    hosted: process.env.PRINT_BRIDGE_DOWNLOAD_URL,
    localExists: existsSync(join(process.cwd(), BRIDGE_PACKAGE_PATH)),
  });
}
