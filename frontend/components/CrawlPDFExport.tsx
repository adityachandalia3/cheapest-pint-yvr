'use client';

import { useRef, useState } from 'react';
import type { CrawlResult, CrawlStop } from '@/app/api/crawl-builder/route';

// ─── Static map URL ───────────────────────────────────────────────────────────

function staticMapUrl(stops: CrawlStop[]): string {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;
  const valid = stops.filter(s => s.bar.latitude && s.bar.longitude);

  const darkStyles = [
    'feature:all|element:geometry|color:0x1d2236',
    'feature:all|element:labels.text.stroke|color:0x1d2236',
    'feature:all|element:labels.text.fill|color:0x8a9bb0',
    'feature:road|element:geometry|color:0x2d3748',
    'feature:water|element:geometry|color:0x0f1929',
    'feature:poi|visibility:off',
    'feature:transit|visibility:off',
  ].map(s => `style=${encodeURIComponent(s)}`).join('&');

  const markers = valid.map((s, i) =>
    `markers=color:0xF5A623|label:${i + 1}|${s.bar.latitude},${s.bar.longitude}`
  ).join('&');

  // Walking path as straight lines between stops
  const path = valid.length > 1
    ? `path=color:0xF5A623CC|weight:4|${valid.map(s => `${s.bar.latitude},${s.bar.longitude}`).join('|')}`
    : '';

  return `https://maps.googleapis.com/maps/api/staticmap?size=800x400&maptype=roadmap&${darkStyles}&${markers}${path ? `&${path}` : ''}&key=${key}`;
}

// ─── Poster template (rendered off-screen, captured by html2canvas) ──────────

function PosterTemplate({ crawl, mapUrl }: { crawl: CrawlResult; mapUrl: string }) {
  const totalHours = Math.floor(crawl.total_duration_min / 60);
  const totalMins = crawl.total_duration_min % 60;
  const durationStr = totalHours > 0
    ? `${totalHours}h${totalMins > 0 ? ` ${totalMins}m` : ''}`
    : `${totalMins}m`;

  const priceStops = crawl.stops.filter(s => s.active_price != null);

  return (
    <div
      style={{
        width: 800,
        backgroundColor: '#0d0d1a',
        fontFamily: "'Arial Black', Arial, sans-serif",
        color: '#ffffff',
        padding: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        backgroundColor: '#070711',
        padding: '24px 32px',
        borderBottom: '2px solid #F5A623',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>🍺</span>
          <span style={{ color: '#F5A623', fontSize: 20, fontWeight: 900, letterSpacing: 2 }}>
            PINT MAP YVR
          </span>
        </div>
        <span style={{ color: '#ffffff33', fontSize: 11, letterSpacing: 1 }}>
          pintmapyvr.com
        </span>
      </div>

      {/* Title block */}
      <div style={{
        padding: '28px 32px 20px',
        background: 'linear-gradient(180deg, #16213e 0%, #0d0d1a 100%)',
      }}>
        <div style={{ color: '#F5A623', fontSize: 11, fontWeight: 900, letterSpacing: 4, marginBottom: 6 }}>
          YOUR CRAWL GUIDE
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 900, margin: 0, lineHeight: 1.1, color: '#ffffff' }}>
          {crawl.title}
        </h1>
        <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
          <span style={{ color: '#ffffff44', fontSize: 12 }}>
            📍 {crawl.neighbourhood}
          </span>
          <span style={{ color: '#ffffff44', fontSize: 12 }}>
            🍺 {crawl.stops.length} stops
          </span>
          <span style={{ color: '#ffffff44', fontSize: 12 }}>
            🚶 {crawl.total_walking_km} km walking
          </span>
          <span style={{ color: '#ffffff44', fontSize: 12 }}>
            ⏱ {durationStr} total
          </span>
        </div>
      </div>

      {/* Map */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mapUrl}
        alt="Crawl map"
        style={{ width: '100%', height: 300, objectFit: 'cover', display: 'block' }}
        crossOrigin="anonymous"
      />

      {/* Stops */}
      <div style={{ padding: '24px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {crawl.stops.map((stop, i) => (
          <div
            key={stop.bar.id}
            style={{
              backgroundColor: '#16213e',
              border: '1px solid rgba(245,166,35,0.2)',
              borderRadius: 12,
              padding: '14px 16px',
            }}
          >
            {/* Stop header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  backgroundColor: '#F5A623', color: '#0d0d1a',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 900, flexShrink: 0,
                }}>
                  {stop.position}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#ffffff', lineHeight: 1.2 }}>
                    {stop.bar.name}
                  </div>
                  {stop.bar.neighbourhood && (
                    <div style={{ fontSize: 10, color: '#ffffff44', marginTop: 2 }}>
                      {stop.bar.neighbourhood}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#F5A623', fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>
                {stop.arrival_time}
              </div>
            </div>

            {/* Price */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              {stop.active_price != null ? (
                <>
                  <span style={{ fontSize: 20, fontWeight: 900, color: '#F5A623', lineHeight: 1 }}>
                    ${Number(stop.active_price).toFixed(2)}
                  </span>
                  {stop.is_happy_hour && (
                    <span style={{
                      fontSize: 9, fontWeight: 900, color: '#34d399',
                      backgroundColor: 'rgba(52,211,153,0.15)',
                      border: '1px solid rgba(52,211,153,0.3)',
                      padding: '2px 6px', borderRadius: 20,
                    }}>
                      🍻 HAPPY HOUR
                    </span>
                  )}
                </>
              ) : (
                <span style={{ fontSize: 11, color: '#ffffff33', fontStyle: 'italic' }}>
                  No price data
                </span>
              )}
            </div>

            {/* Reason */}
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, margin: 0 }}>
              {stop.reason}
            </p>

            {/* Walk from prev */}
            {stop.walking_km_from_prev != null && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 10, color: '#ffffff33' }}>
                🚶 {stop.walking_minutes_from_prev} min walk from previous stop · {stop.walking_km_from_prev} km
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Totals footer */}
      <div style={{
        margin: '0 32px',
        backgroundColor: '#16213e',
        border: '1px solid rgba(245,166,35,0.2)',
        borderRadius: 12,
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-around',
        marginBottom: 24,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#F5A623' }}>
            {priceStops.length > 0 ? `$${crawl.total_spend.toFixed(2)}` : '—'}
          </div>
          <div style={{ fontSize: 10, color: '#ffffff44', marginTop: 2 }}>
            {priceStops.length > 0 ? `est. spend (${priceStops.length} bars)` : 'no price data'}
          </div>
        </div>
        <div style={{ width: 1, backgroundColor: 'rgba(245,166,35,0.1)' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#F5A623' }}>{crawl.total_walking_km} km</div>
          <div style={{ fontSize: 10, color: '#ffffff44', marginTop: 2 }}>total walking</div>
        </div>
        <div style={{ width: 1, backgroundColor: 'rgba(245,166,35,0.1)' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#F5A623' }}>{durationStr}</div>
          <div style={{ fontSize: 10, color: '#ffffff44', marginTop: 2 }}>total night</div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        backgroundColor: '#F5A623',
        padding: '12px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ color: '#0d0d1a', fontSize: 12, fontWeight: 900, letterSpacing: 1 }}>
          🍺 PINT MAP YVR — Find the cheapest pint in Vancouver
        </span>
        <span style={{ color: '#0d0d1a44', fontSize: 11 }}>pintmapyvr.com</span>
      </div>
    </div>
  );
}

// ─── Export button ────────────────────────────────────────────────────────────

export default function CrawlPDFExport({ crawl }: { crawl: CrawlResult }) {
  const [loading, setLoading] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);
  const mapUrl = staticMapUrl(crawl.stops);

  async function handleDownload() {
    if (loading || !posterRef.current) return;
    setLoading(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const canvas = await html2canvas(posterRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#0d0d1a',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);

      const fileName = `${crawl.neighbourhood.toLowerCase().replace(/\s+/g, '-')}-crawl.pdf`;
      pdf.save(fileName);
    } catch (e) {
      console.error('PDF export failed:', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Download button */}
      <button
        onClick={handleDownload}
        disabled={loading}
        className="flex items-center gap-2 bg-[#16213e] hover:bg-[#1e2d4a] disabled:opacity-50 text-[#F5A623] border border-[#F5A623]/30 hover:border-[#F5A623]/70 font-black text-sm px-4 py-2.5 rounded-xl transition-all duration-200"
      >
        {loading ? (
          <>
            <span className="inline-block w-3.5 h-3.5 border-2 border-[#F5A623]/30 border-t-[#F5A623] rounded-full animate-spin" />
            Generating...
          </>
        ) : (
          <>⬇ Download PDF</>
        )}
      </button>

      {/* Hidden poster — rendered off-screen for html2canvas */}
      <div
        style={{ position: 'fixed', top: -9999, left: -9999, zIndex: -1 }}
        aria-hidden
      >
        <div ref={posterRef}>
          <PosterTemplate crawl={crawl} mapUrl={mapUrl} />
        </div>
      </div>
    </>
  );
}
