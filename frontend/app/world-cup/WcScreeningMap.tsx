'use client';

import { useState, useCallback, useMemo } from 'react';
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import type { WcScreeningBar } from './page';

type SupporterInfo = { country: string; flag: string };

type Props = {
  screeningBars: WcScreeningBar[];
  supportersBarMap: Record<string, SupporterInfo>;
  className?: string;
};

const VANCOUVER_CENTER = { lat: 49.2827, lng: -123.1207 };
const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };

const WC_MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#0d1a3a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0d1a3a' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e3a6e' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#a8b8d0' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#0d1a3a' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c5282' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#b0cfe8' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#060d1e' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3b6ea5' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#a0b4cc' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#334e87' }] },
];

function pinSvg(fill: string, w: number, h: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="${w}" height="${h}"><path d="M12 0C5.37 0 0 5.37 0 12c0 7.5 12 24 12 24S24 19.5 24 12C24 5.37 18.63 0 12 0z" fill="${fill}" stroke="white" stroke-width="1.5"/><circle cx="12" cy="12" r="5" fill="rgba(255,255,255,0.35)"/></svg>`;
}

export default function WcScreeningMap({ screeningBars, supportersBarMap, className }: Props) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedBarId, setSelectedBarId] = useState<string | null>(null);
  const [nearMeLoading, setNearMeLoading] = useState(false);

  const handleNearMe = useCallback(() => {
    if (!navigator?.geolocation) return;
    setNearMeLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNearMeLoading(false);
        if (map) {
          map.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          map.setZoom(14);
        }
      },
      () => setNearMeLoading(false),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 },
    );
  }, [map]);

  const goldIcon = useMemo(() => {
    if (!isLoaded) return undefined;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(pinSvg('#FFD966', 26, 39))}`,
      scaledSize: new window.google.maps.Size(26, 39),
      anchor: new window.google.maps.Point(13, 39),
    };
  }, [isLoaded]);

  const amberIcon = useMemo(() => {
    if (!isLoaded) return undefined;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(pinSvg('#B34207', 20, 30))}`,
      scaledSize: new window.google.maps.Size(20, 30),
      anchor: new window.google.maps.Point(10, 30),
    };
  }, [isLoaded]);

  const selectedBar = selectedBarId ? (screeningBars.find(b => b.id === selectedBarId) ?? null) : null;
  const selectedSupporter = selectedBarId ? (supportersBarMap[selectedBarId] ?? null) : null;

  if (!isLoaded) {
    return (
      <div
        className={className ?? 'h-[380px] md:h-[480px] flex items-center justify-center'}
        style={{ background: '#0E1B3D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>Loading map…</p>
      </div>
    );
  }

  return (
    <div className={className ?? 'relative h-[380px] md:h-[480px]'}>
      <button
        onClick={handleNearMe}
        disabled={nearMeLoading}
        className="absolute top-3 right-3 z-10 flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-full shadow-md transition-opacity hover:opacity-80 disabled:opacity-50"
        style={{ background: '#fffbeb', color: '#B34207', border: '1px solid #e8dcc8' }}
      >
        {nearMeLoading ? '…' : '📍'} Near Me
      </button>

      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={VANCOUVER_CENTER}
        zoom={12}
        options={{ disableDefaultUI: true, zoomControl: true, styles: WC_MAP_STYLES }}
        onLoad={m => setMap(m)}
        onUnmount={() => setMap(null)}
        onClick={() => setSelectedBarId(null)}
      >
        {screeningBars.map(bar => {
          const isSupporter = bar.id in supportersBarMap;
          return (
            <Marker
              key={bar.id}
              position={{ lat: bar.latitude, lng: bar.longitude }}
              icon={isSupporter ? goldIcon : amberIcon}
              zIndex={isSupporter ? 10 : 5}
              onClick={() => setSelectedBarId(bar.id)}
            />
          );
        })}

        {selectedBar && (
          <InfoWindow
            position={{ lat: selectedBar.latitude, lng: selectedBar.longitude }}
            onCloseClick={() => setSelectedBarId(null)}
            options={{ pixelOffset: new window.google.maps.Size(0, -42) }}
          >
            <div style={{
              maxWidth: 220,
              fontFamily: 'Inter, sans-serif',
              padding: '4px 2px 2px',
              background: '#fffbeb',
              borderRadius: 0,
            }}>
              <p style={{ fontWeight: 900, fontSize: 14, color: '#1c1410', margin: '0 0 5px' }}>
                {selectedBar.name}
              </p>
              {selectedSupporter ? (
                <span style={{
                  display: 'inline-block',
                  background: '#FFD966',
                  color: '#14110c',
                  borderRadius: 999,
                  padding: '2px 8px',
                  fontSize: 11,
                  fontWeight: 700,
                  marginBottom: 8,
                }}>
                  {selectedSupporter.flag} {selectedSupporter.country}
                </span>
              ) : (
                <p style={{ color: '#a0855a', fontSize: 11, margin: '0 0 8px' }}>
                  📺 Confirmed screening
                </p>
              )}
              <br />
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedBar.name + ' Vancouver BC')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  background: '#B34207',
                  color: '#ffffff',
                  borderRadius: 20,
                  padding: '5px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                Get Directions →
              </a>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Pin legend */}
      <div
        className="absolute bottom-3 left-3 z-10 flex items-center gap-3 px-3 py-2 rounded-full text-xs font-semibold"
        style={{ background: 'rgba(13,26,58,0.85)', border: '1px solid rgba(255,255,255,0.15)' }}
      >
        <span style={{ color: '#FFD966' }}>● Supporters bar</span>
        <span style={{ color: '#B34207' }}>● Screening venue</span>
      </div>
    </div>
  );
}
