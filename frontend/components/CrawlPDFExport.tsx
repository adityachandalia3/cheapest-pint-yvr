'use client';

import { useRef, useState } from 'react';
import type { CrawlResult, CrawlStop } from '@/app/api/crawl-builder/route';

// ─── Static map URL ───────────────────────────────────────────────────────────

function proxiedMapUrl(url: string): string {
  return `/api/proxy-map?url=${encodeURIComponent(url)}`;
}

function staticMapUrl(stops: CrawlStop[]): string {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;
  const valid = stops.filter(s => s.bar.latitude && s.bar.longitude);

  const darkStyles = [
    'feature:all|element:geometry|color:0x1a1f35',
    'feature:all|element:labels.text.stroke|color:0x1a1f35',
    'feature:all|element:labels.text.fill|color:0x8a9bb0',
    'feature:road|element:geometry|color:0x2d3a5c',
    'feature:road.highway|element:geometry|color:0x3d4f7a',
    'feature:water|element:geometry|color:0x0a1628',
    'feature:poi|visibility:off',
    'feature:transit|visibility:off',
    'feature:administrative.locality|element:labels.text.fill|color:0xaabbcc',
  ].map(s => `style=${encodeURIComponent(s)}`).join('&');

  const markers = valid.map((s, i) =>
    `markers=color:0xF5A623|label:${i + 1}|${s.bar.latitude},${s.bar.longitude}`
  ).join('&');

  const path = valid.length > 1
    ? `path=color:0xF5A623CC|weight:3|${valid.map(s => `${s.bar.latitude},${s.bar.longitude}`).join('|')}`
    : '';

  // scale=2 doubles the pixel density — fixes pixelation in the PDF
  return `https://maps.googleapis.com/maps/api/staticmap?size=900x400&scale=2&maptype=roadmap&${darkStyles}&${markers}${path ? `&${path}` : ''}&key=${key}`;
}

// ─── Poster template ──────────────────────────────────────────────────────────

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
        width: 900,
        backgroundColor: '#0d0f1f',
        fontFamily: "'Arial Black', 'Arial Bold', Arial, sans-serif",
        color: '#ffffff',
        padding: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0a0c1a 0%, #111427 100%)',
        padding: '20px 36px',
        borderBottom: '2px solid #F5A623',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 26 }}>🍺</span>
          <span style={{ color: '#F5A623', fontSize: 18, fontWeight: 900, letterSpacing: 3 }}>
            PINT MAP YVR
          </span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, letterSpacing: 1 }}>
          pintmapyvr.com
        </span>
      </div>

      {/* Title block */}
      <div style={{
        padding: '28px 36px 20px',
        background: 'linear-gradient(180deg, #141828 0%, #0d0f1f 100%)',
      }}>
        <div style={{ color: '#F5A623', fontSize: 10, fontWeight: 900, letterSpacing: 5, marginBottom: 8 }}>
          YOUR CRAWL GUIDE
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 900, margin: 0, lineHeight: 1.1, color: '#ffffff' }}>
          {crawl.title}
        </h1>
        <div style={{ display: 'flex', gap: 24, marginTop: 14, flexWrap: 'wrap' }}>
          {[
            { icon: '📍', text: crawl.neighbourhood },
            { icon: '🍺', text: `${crawl.stops.length} stops` },
            { icon: '🚶', text: `${crawl.total_walking_km} km walking` },
            { icon: '⏱', text: `${durationStr} total` },
          ].map(({ icon, text }) => (
            <span key={text} style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}>
              {icon} {text}
            </span>
          ))}
        </div>
      </div>

      {/* Map — position:relative so we can overlay a gradient */}
      <div style={{ position: 'relative', width: '100%', height: 320, overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mapUrl}
          alt="Crawl map"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        {/* Bottom fade to blend into stop cards */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
          background: 'linear-gradient(to bottom, transparent, #0d0f1f)',
        }} />
      </div>

      {/* Stop cards */}
      <div style={{ padding: '20px 36px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {crawl.stops.map((stop) => (
          <div
            key={stop.bar.id}
            style={{
              background: 'linear-gradient(135deg, #181d35 0%, #131727 100%)',
              border: '1px solid rgba(245,166,35,0.18)',
              borderRadius: 14,
              padding: '16px 18px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Subtle corner accent */}
            <div style={{
              position: 'absolute', top: 0, right: 0,
              width: 40, height: 40,
              background: 'radial-gradient(circle at top right, rgba(245,166,35,0.08), transparent 70%)',
            }} />

            {/* Stop header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #F5A623, #e09010)',
                  color: '#0d0f1f',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 900, flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(245,166,35,0.4)',
                }}>
                  {stop.position}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#ffffff', lineHeight: 1.2 }}>
                    {stop.bar.name}
                  </div>
                  {stop.bar.neighbourhood && (
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                      {stop.bar.neighbourhood}
                    </div>
                  )}
                </div>
              </div>
              <div style={{
                fontSize: 11, color: '#F5A623', fontWeight: 700,
                flexShrink: 0, marginLeft: 8,
                background: 'rgba(245,166,35,0.1)',
                padding: '3px 8px', borderRadius: 20,
                border: '1px solid rgba(245,166,35,0.2)',
              }}>
                {stop.arrival_time}
              </div>
            </div>

            {/* Price row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {stop.active_price != null ? (
                <>
                  <span style={{ fontSize: 24, fontWeight: 900, color: '#F5A623', lineHeight: 1 }}>
                    ${Number(stop.active_price).toFixed(2)}
                  </span>
                  {stop.is_happy_hour && (
                    <span style={{
                      fontSize: 9, fontWeight: 900, color: '#34d399',
                      backgroundColor: 'rgba(52,211,153,0.12)',
                      border: '1px solid rgba(52,211,153,0.3)',
                      padding: '2px 7px', borderRadius: 20,
                    }}>
                      🍻 HAPPY HOUR
                    </span>
                  )}
                </>
              ) : (
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>
                  Price not available
                </span>
              )}
            </div>

            {/* Reason */}
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', lineHeight: 1.55, margin: 0 }}>
              {stop.reason}
            </p>

            {/* Walk from prev */}
            {stop.walking_km_from_prev != null && (
              <div style={{
                marginTop: 10, paddingTop: 10,
                borderTop: '1px solid rgba(255,255,255,0.05)',
                fontSize: 10, color: 'rgba(255,255,255,0.22)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span>🚶</span>
                <span>{stop.walking_minutes_from_prev} min walk from previous stop · {stop.walking_km_from_prev} km</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Totals bar */}
      <div style={{
        margin: '20px 36px',
        background: 'linear-gradient(135deg, #181d35, #131727)',
        border: '1px solid rgba(245,166,35,0.2)',
        borderRadius: 14,
        padding: '18px 28px',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
      }}>
        {[
          {
            value: priceStops.length > 0 ? `$${crawl.total_spend.toFixed(2)}` : '—',
            label: priceStops.length > 0 ? `est. spend (${priceStops.length} bars)` : 'no price data',
          },
          { value: `${crawl.total_walking_km} km`, label: 'total walking' },
          { value: durationStr, label: 'total night' },
        ].map(({ value, label }, i, arr) => (
          <div key={label} style={{ display: 'flex', gap: 0 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#F5A623' }}>{value}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>{label}</div>
            </div>
            {i < arr.length - 1 && (
              <div style={{ width: 1, backgroundColor: 'rgba(245,166,35,0.12)', margin: '0 28px' }} />
            )}
          </div>
        ))}
      </div>

      {/* Footer bar */}
      <div style={{
        background: 'linear-gradient(90deg, #c87f10, #F5A623)',
        padding: '13px 36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ color: '#0d0f1f', fontSize: 12, fontWeight: 900, letterSpacing: 0.5 }}>
          🍺 PINT MAP YVR — Find the cheapest pint in Vancouver
        </span>
        <span style={{ color: 'rgba(0,0,0,0.35)', fontSize: 11 }}>pintmapyvr.com</span>
      </div>
    </div>
  );
}

// ─── Export button ────────────────────────────────────────────────────────────

export default function CrawlPDFExport({ crawl }: { crawl: CrawlResult }) {
  const [loading, setLoading] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);
  const mapUrl = proxiedMapUrl(staticMapUrl(crawl.stops));

  async function handleDownload() {
    if (loading || !posterRef.current) return;
    setLoading(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const canvas = await html2canvas(posterRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#0d0f1f',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width / 3, canvas.height / 3],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 3, canvas.height / 3);

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

      {/* Hidden poster rendered off-screen for html2canvas */}
      <div style={{ position: 'fixed', top: -9999, left: -9999, zIndex: -1 }} aria-hidden>
        <div ref={posterRef}>
          <PosterTemplate crawl={crawl} mapUrl={mapUrl} />
        </div>
      </div>
    </>
  );
}
