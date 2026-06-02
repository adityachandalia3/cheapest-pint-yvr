import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const placeId = searchParams.get('placeId');

  if (!placeId) return NextResponse.json({ error: 'Missing placeId' }, { status: 400 });

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return NextResponse.json({ error: 'No API key' }, { status: 500 });

  const detailsRes = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${key}`,
    { next: { revalidate: 86400 } }
  );
  const details = await detailsRes.json();
  const photoRef = details.result?.photos?.[0]?.photo_reference;

  if (!photoRef) return NextResponse.json({ error: 'No photo' }, { status: 404 });

  const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=900&photoreference=${photoRef}&key=${key}`;

  // Redirect — browser/CDN caches the photo directly
  return NextResponse.redirect(photoUrl, {
    headers: { 'Cache-Control': 'public, max-age=86400' },
  });
}
