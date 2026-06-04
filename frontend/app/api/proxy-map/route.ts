import { NextRequest, NextResponse } from 'next/server';

// Proxies Google Static Maps images so html2canvas can render them
// without CORS/tainted-canvas issues (same-origin fetch).
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return new NextResponse('Missing url', { status: 400 });

  if (!url.startsWith('https://maps.googleapis.com/maps/api/staticmap')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const res = await fetch(url);
  if (!res.ok) return new NextResponse('Map fetch failed', { status: 502 });

  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'image/png',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
