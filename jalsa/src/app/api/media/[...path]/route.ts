import { NextResponse } from 'next/server';
import { attempt, db } from '@/lib/supabase/server';
import { MEDIA_URL } from '@/lib/media';

/**
 * An uploaded image, served by this application (items 23 and 32, 25-Sep-2026).
 *
 * WHY THE APP SERVES IT AND NOT SUPABASE
 *   Guardrail 3: the browser never speaks to Supabase. The `media` bucket is private; this route
 *   reads it with the server key and hands the bytes back. The URL is the file's own name -
 *   `/api/media/menu/<uuid>.png` - so it never changes meaning, and it is cached as immutable.
 *
 * WHAT IT WILL SERVE: only `menu/` and `brand/` files whose names are a uuid and .png or .jpg,
 * checked against the same pattern the writer stores. Anything else is a 404, never a read.
 * Public on purpose: a dish photo and the restaurant's logo are shown to guests.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }): Promise<NextResponse> {
  const { path } = await ctx.params;
  const key = (path ?? []).join('/');
  if (!MEDIA_URL.test(`/api/media/${key}`)) return new NextResponse('Not found', { status: 404 });

  const result = await attempt('media', async () => {
    const { data, error } = await db().storage.from('media').download(key);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  });
  if (!result.ok || !result.value) return new NextResponse('Not found', { status: 404 });

  return new NextResponse(result.value, {
    headers: {
      'Content-Type': key.endsWith('.png') ? 'image/png' : 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
