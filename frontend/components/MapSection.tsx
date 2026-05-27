'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import { BarWithActivePrice } from '@/lib/types';
import { getActivePriceForPint } from '@/lib/priceUtils';

interface Props {
  bars: BarWithActivePrice[];
  cheapestBarId: string | null;
  highlightedBarId: string | null;
  onBarSelect: (id: string | null) => void;
}

const VANCOUVER_CENTER = { lat: 49.2827, lng: -123.1207 };
const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };

const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1d2236' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1d2236' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a9bb0' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d3748' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3d4e6b' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f1929' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4a6074' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2d3748' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }],
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  cheapest_beer: '🍺 Beer',
  cheapest_lager: '🍻 Lager',
  cheapest_ipa: '🟡 IPA',
};

export default function MapSection({ bars, cheapestBarId, highlightedBarId, onBarSelect }: Props) {
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

  const selectedBar = useMemo(
    () => bars.find(b => b.id === selectedBarId) ?? null,
    [selectedBarId, bars]
  );

  const now = new Date();

  if (!isLoaded) {
    return (
      <div className="w-full h-[400px] md:h-[560px] bg-[#16213e] flex items-center justify-center">
        <div className="text-[#F5A623] text-lg font-bold animate-pulse">Loading map…</div>
      </div>
    );
  }

  return (
    <div className="w-full h-[400px] md:h-[560px]">
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={VANCOUVER_CENTER}
        zoom={12}
        options={{ disableDefaultUI: true, zoomControl: true, styles: MAP_STYLES }}
        onLoad={onLoad}
        onUnmount={onUnmount}
      >
        {bars.map(bar => {
          if (!bar.latitude || !bar.longitude) return null;
          const isCheapest = bar.id === cheapestBarId;
          return (
            <Marker
              key={bar.id}
              position={{ lat: bar.latitude, lng: bar.longitude }}
              icon={isCheapest ? goldIcon : regularIcon}
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

              {selectedBar.happy_hour_start && selectedBar.happy_hour_end && (
                <p
                  style={{
                    fontSize: '11px',
                    color: selectedBar.isHappyHour ? '#c27a00' : '#aaa',
                    marginBottom: '10px',
                  }}
                >
                  {selectedBar.isHappyHour ? '🎉' : '🕐'} Happy Hour:{' '}
                  {selectedBar.happy_hour_start.slice(0, 5)} –{' '}
                  {selectedBar.happy_hour_end.slice(0, 5)}
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
                  background: '#F5A623',
                  color: '#1a1a2e',
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
