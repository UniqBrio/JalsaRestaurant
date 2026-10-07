import { NextResponse } from 'next/server';
import { attempt, currentRestaurantId, db } from '@/lib/supabase/server';
import { MEDIA_URL, takeawayPhotoBill } from '@/lib/media';
import { currentStaff } from '@/lib/db/auth';

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
 *
 * TAKEAWAY PHOTOS ARE NOT PUBLIC (07-Oct-2026). `takeaway/<bill>/<uuid>` is answered only to a
 * signed-in owner or staff member holding `orders.view`, and only while that bill is this
 * restaurant's takeaway and the photo is the one it carries now - a replaced or removed photo's
 * old URL answers 404 even before its file is gone. Never cached by anything shared.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }): Promise<NextResponse> {
  const { path } = await ctx.params;
  const key = (path ?? []).join('/');
  const photoBill = takeawayPhotoBill(`/api/media/${key}`);
  if (photoBill) return takeawayPhoto(key, photoBill);
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

/** A takeaway order's photo, for the people who run orders - nobody else (07-Oct-2026). */
async function takeawayPhoto(key: string, billId: string): Promise<NextResponse> {
  const notFound = () => new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const result = await attempt('media', async () => {
    const who = (await currentStaff('owner')) ?? (await currentStaff('staff'));
    if (!who || who.provisional || !who.grants.can('orders.view')) return null;
    const restaurantId = await currentRestaurantId();
    const { data: bill } = await db()
      .from('bill')
      .select('photo_url')
      .eq('id', billId)
      .eq('restaurant_id', restaurantId)
      .eq('order_type', 'takeaway')
      .maybeSingle();
    if (!bill || bill.photo_url !== `/api/media/${key}`) return null;
    const { data, error } = await db().storage.from('media').download(key);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  });
  // Not signed in, no grant, another restaurant's, or not this order's photo: all the same 404,
  // so the route says nothing about which orders or photos exist.
  if (!result.ok || !result.value) return notFound();
  return new NextResponse(result.value, {
    headers: {
      'Content-Type': key.endsWith('.png') ? 'image/png' : 'image/jpeg',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
