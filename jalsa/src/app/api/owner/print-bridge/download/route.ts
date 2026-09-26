import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { fail, handler } from '@/lib/route';
import { currentStaff } from '@/lib/db/auth';
import { currentBridgeDownload } from '@/lib/print-bridge-artifact';
import { BRIDGE_PACKAGE_FILENAME, DOWNLOAD_UNAVAILABLE } from '@/lib/print-bridge-download';

/**
 * GET /api/owner/print-bridge/download — the "Download for Windows" button.
 *
 * Behind the owner's sign-in and `set.printer`, the grant every other printer operation uses. The
 * package holds no credential — a computer only gets one by pairing — but it is not advertised to
 * the world either, and the owner never sees where it is hosted.
 *
 * Hosted → a redirect to the published artifact. Local → the file, streamed. Neither → a 404 that
 * says so in a sentence, never a link that leads nowhere.
 */
export const GET = handler(async (): Promise<NextResponse> => {
  const staff = await currentStaff('owner');
  if (!staff) return fail(401, { code: 'unauthenticated', message: 'Sign in with your PIN before doing that.' });
  if (!staff.grants.can('set.printer')) {
    return fail(403, {
      code: 'forbidden',
      message: 'Setting up printers is not part of your role.',
      permission: 'set.printer',
    });
  }

  const source = currentBridgeDownload();
  if (source.kind === 'hosted') return NextResponse.redirect(source.url, 302);
  if (source.kind === 'none') return fail(404, { code: 'download_unavailable', message: DOWNLOAD_UNAVAILABLE });

  const bytes = await readFile(join(process.cwd(), source.path));
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${BRIDGE_PACKAGE_FILENAME}"`,
      'content-length': String(bytes.length),
      'cache-control': 'no-store',
    },
  });
});
