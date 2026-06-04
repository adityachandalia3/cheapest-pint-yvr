'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import { BarWithActivePrice } from '@/lib/types';
import { getActivePriceForPint } from '@/lib/priceUtils';

interface Props {
  bars: BarWithActivePrice[];
  cheapestBarId: string | null;
  highlightedBarId: string | null;
  hoveredBarId?: string | null;
  ranks?: Record<string, number>; // barId → rank (1-based); when set, uses numbered circle pins
  onBarSelect: (id: string | null) => void;
  className?: string;
  showResetView?: boolean;
}

const VANCOUVER_CENTER = { lat: 49.2827, lng: -123.1207 };
const DEFAULT_ZOOM = 12;
const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };

const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#f5f0e8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f0e8' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#78716c' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#57534e' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#fde8c4' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#92400e' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#bfdbfe' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3b82f6' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#e7e5e4' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#44403c' }] },
];

const CATEGORY_LABELS: Record<string, string> = {
  cheapest_beer: '🍺 Beer',
  cheapest_lager: '🍻 Lager',
  cheapest_ipa: '🟡 IPA',
};

export default function MapSection({ bars, cheapestBarId, highlightedBarId, hoveredBarId, ranks, onBarSelect, className, showResetView }: Props) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedBarId, setSelectedBarId] = useState<string | null>(null);

  const regularIcon = useMemo(() => {
    if (!isLoaded) return undefined;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36"><path d="M12 0C5.37 0 0 5.37 0 12c0 7.5 12 24 12 24S24 19.5 24 12C24 5.37 18.63 0 12 0z" fill="#F5A623" stroke="white" stroke-width="1.5"/><circle cx="12" cy="12" r="5" fill="rgba(255,255,255,0.35)"/></svg>`;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new window.google.maps.Size(24, 36),
      anchor: new window.google.maps.Point(12, 36),
    };
  }, [isLoaded]);

  const goldIcon = useMemo(() => {
    if (!isLoaded) return undefined;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" width="32" height="48"><path d="M16 0C7.16 0 0 7.16 0 16c0 10 16 32 16 32S32 26 32 16C32 7.16 24.84 0 16 0z" fill="#FFD700" stroke="white" stroke-width="2"/><polygon points="16,7 18.5,13 25,13 20,17 22,23 16,19 10,23 12,17 7,13 13.5,13" fill="white"/></svg>`;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new window.google.maps.Size(32, 48),
      anchor: new window.google.maps.Point(16, 48),
    };
  }, [isLoaded]);

  const rankedIconCache = useMemo(() => {
    if (!isLoaded) return {};
    const RANK_COLORS: Record<number, string> = { 1: '#C9A227', 2: '#9E9E9E', 3: '#CD7F32' };
    const cache: Record<number, google.maps.Icon> = {};
    for (let rank = 1; rank <= 10; rank++) {
      const fill = RANK_COLORS[rank] ?? '#B34207';
      const size = rank <= 3 ? 36 : 30;
      const r = size / 2;
      const fontSize = rank <= 3 ? 15 : 13;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${r}" cy="${r}" r="${r}" fill="${fill}"/><circle cx="${r}" cy="${r}" r="${r - 2}" fill="none" stroke="white" stroke-width="1.5"/><text x="${r}" y="${r + fontSize * 0.38}" text-anchor="middle" font-size="${fontSize}" font-weight="900" font-family="Inter,Arial,sans-serif" fill="white">${rank}</text></svg>`;
      cache[rank] = {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
        scaledSize: new window.google.maps.Size(size, size),
        anchor: new window.google.maps.Point(r, r),
      };
    }
    return cache;
  }, [isLoaded]);

  const onLoad = useCallback((mapInstance: google.maps.Map) => setMap(mapInstance), []);
  const onUnmount = useCallback(() => setMap(null), []);

  useEffect(() => {
    if (!map || !highlightedBarId) return;
    const bar = bars.find(b => b.id === highlightedBarId);
    if (!bar?.latitude || !bar?.longitude) return;
    map.panTo({ lat: bar.latitude, lng: bar.longitude });
    map.setZoom(15);
    setSelectedBarId(highlightedBarId);
  }, [highlightedBarId, map, bars]);

  // hoveredBarId (from leaderboard) shows InfoWindow without panning
  useEffect(() => {
    if (hoveredBarId !== undefined && hoveredBarId !== null) {
      setSelectedBarId(hoveredBarId);
    } else if (hoveredBarId === null) {
      setSelectedBarId(prev => (prev === hoveredBarId ? null : prev));
    }
  }, [hoveredBarId]);

  const displayBarId = hoveredBarId ?? selectedBarId;
  const selectedBar = useMemo(
    () => bars.find(b => b.id === displayBarId) ?? null,
    [displayBarId, bars]
  );

  const now = new Date();

  const sizeClass = className ?? 'w-full h-[350px] md:h-[500px]';

  if (!isLoaded) {
    return (
      <div className={`${sizeClass} bg-[#fef9f0] flex items-center justify-center`}>
        <div className="text-stone-400 text-lg font-bold animate-pulse">Loading map…</div>
      </div>
    );
  }

  return (
    <div className={`${sizeClass} relative`}>
      {showResetView && map && (
        <button
          onClick={() => { map.setCenter(VANCOUVER_CENTER); map.setZoom(DEFAULT_ZOOM); }}
          className="absolute top-3 left-3 z-10 bg-white text-[#1c1917] text-xs font-black px-3 py-1.5 rounded-full shadow-md border border-[#fde8c4] hover:border-[#B34207]/40 transition-colors"
        >
          Reset View
        </button>
      )}
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={VANCOUVER_CENTER}
        zoom={DEFAULT_ZOOM}
        options={{ disableDefaultUI: true, zoomControl: true, styles: MAP_STYLES }}
        onLoad={onLoad}
        onUnmount={onUnmount}
      >
        {bars.map(bar => {
          if (!bar.latitude || !bar.longitude) return null;
          let icon: google.maps.Icon | undefined;
          if (ranks) {
            const rank = ranks[bar.id];
            icon = rank ? rankedIconCache[rank] : undefined;
          } else {
            icon = bar.id === cheapestBarId ? goldIcon : regularIcon;
          }
          return (
            <Marker
              key={bar.id}
              position={{ lat: bar.latitude, lng: bar.longitude }}
              icon={icon}
              onClick={() => {
                setSelectedBarId(bar.id);
                onBarSelect(bar.id);
              }}
            />
          );
        })}

        {selectedBar && selectedBar.latitude && selectedBar.longitude && (
          <InfoWindow
            position={{ lat: selectedBar.latitude, lng: selectedBar.longitude }}
            onCloseClick={() => {
              setSelectedBarId(null);
              onBarSelect(null);
            }}
            options={{ pixelOffset: new window.google.maps.Size(0, -40) }}
          >
            <div style={{ maxWidth: '230px', fontFamily: 'Inter, sans-serif', padding: '4px 2px' }}>
              <p style={{ fontWeight: 900, fontSize: '15px', marginBottom: '2px', color: '#111' }}>
                {selectedBar.name}
              </p>
              {selectedBar.neighbourhood && (
                <p style={{ color: '#888', fontSize: '12px', marginBottom: '10px' }}>
                  {selectedBar.neighbourhood}
                </p>
              )}

              <div
                style={{ borderTop: '1px solid #eee', paddingTop: '8px', marginBottom: '8px' }}
              >
                {(['cheapest_beer', 'cheapest_lager', 'cheapest_ipa'] as const).map(cat => {
                  const pint = selectedBar.pint_prices.find(p => p.category === cat);
                  if (!pint) return null;
                  const price = getActivePriceForPint(selectedBar, pint, now);
                  return (
                    <div
                      key={cat}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '4px',
                        fontSize: '13px',
                      }}
                    >
                      <span style={{ color: '#555' }}>{CATEGORY_LABELS[cat]}</span>
                      <span style={{ fontWeight: 700, color: '#c27a00' }}>${price.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>

              {selectedBar.happy_hour_windows?.[0] && (
                <p
                  style={{
                    fontSize: '11px',
                    color: selectedBar.isHappyHour ? '#c27a00' : '#aaa',
                    marginBottom: '10px',
                  }}
                >
                  {selectedBar.isHappyHour ? '🎉' : '🕐'} Happy Hour:{' '}
                  {selectedBar.happy_hour_windows[0].start_time.slice(0, 5)} –{' '}
                  {selectedBar.happy_hour_windows[0].end_time.slice(0, 5)}
                </p>
              )}

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  selectedBar.name + ' Vancouver'
                )}&query_place_id=${selectedBar.google_place_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  background: '#B34207',
                  color: '#ffffff',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontWeight: 700,
                  fontSize: '12px',
                  textDecoration: 'none',
                }}
              >
                📍 Get Directions
              </a>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}
