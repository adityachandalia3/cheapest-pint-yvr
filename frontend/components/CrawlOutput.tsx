'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { GoogleMap, DirectionsRenderer, useJsApiLoader } from '@react-google-maps/api';
import type { CrawlResult, CrawlStop } from '@/app/api/crawl-builder/route';

const CrawlPDFExport = dynamic(() => import('./CrawlPDFExport'), { ssr: false });

// ─── Map styles — light/warm ──────────────────────────────────────────────────

const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#f5f0e8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f0e8' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#78716c' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#57534e' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#fde8c4' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#bfdbfe' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#e7e5e4' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#44403c' }] },
];

// ─── Numbered pin SVG ─────────────────────────────────────────────────────────

function pinUrl(num: number, highlight = false): string {
  const bg = highlight ? '#1c1917' : '#B34207';
  const fg = '#ffffff';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">
    <path d="M17 0C8.163 0 1 7.163 1 16c0 9.5 16 28 16 28S33 25.5 33 16C33 7.163 25.837 0 17 0z" fill="${bg}" stroke="white" stroke-width="1.5"/>
    <circle cx="17" cy="16" r="9" fill="${bg === '#B34207' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.15)'}"/>
    <text x="17" y="21" text-anchor="middle" fill="${fg}" font-family="Arial Black, Arial, sans-serif" font-size="11" font-weight="900">${num}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

// ─── Map component ────────────────────────────────────────────────────────────

function CrawlMap({ stops }: { stops: CrawlStop[] }) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [directionsError, setDirectionsError] = useState(false);

  useEffect(() => {
    if (!isLoaded || stops.length < 2) return;
    const validStops = stops.filter(s => s.bar.latitude && s.bar.longitude);
    if (validStops.length < 2) return;

    const service = new google.maps.DirectionsService();
    const origin = { lat: validStops[0].bar.latitude!, lng: validStops[0].bar.longitude! };
    const dest = {
      lat: validStops[validStops.length - 1].bar.latitude!,
      lng: validStops[validStops.length - 1].bar.longitude!,
    };
    const waypoints = validStops.slice(1, -1).map(s => ({
      location: { lat: s.bar.latitude!, lng: s.bar.longitude! },
      stopover: true,
    }));

    service.route(
      { origin, destination: dest, waypoints, travelMode: google.maps.TravelMode.WALKING },
      (result, status) => {
        if (status === 'OK' && result) setDirections(result);
        else setDirectionsError(true);
      }
    );
  }, [isLoaded, stops]);

  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    const bounds = new google.maps.LatLngBounds();
    stops.forEach(s => {
      if (s.bar.latitude && s.bar.longitude)
        bounds.extend({ lat: s.bar.latitude, lng: s.bar.longitude });
    });
    if (!bounds.isEmpty()) mapRef.current.fitBounds(bounds, 60);
  }, [isLoaded, stops]);

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#fef9f0] rounded-2xl border border-[#fde8c4]">
        <span className="text-stone-400 text-sm animate-pulse">Loading map...</span>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%', borderRadius: '16px' }}
      options={{
        styles: MAP_STYLES,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'cooperative',
      }}
      onLoad={map => { mapRef.current = map; }}
    >
      {directions && !directionsError && (
        <DirectionsRenderer
          directions={directions}
          options={{
            suppressMarkers: true,
            polylineOptions: {
              strokeColor: '#B34207',
              strokeWeight: 5,
              strokeOpacity: 0.85,
            },
          }}
        />
      )}

      {isLoaded && stops.map(stop => {
        if (!stop.bar.latitude || !stop.bar.longitude) return null;
        return (
          <CustomMarker
            key={stop.bar.id}
            position={{ lat: stop.bar.latitude, lng: stop.bar.longitude }}
            num={stop.position}
            map={mapRef.current}
          />
        );
      })}
    </GoogleMap>
  );
}

function CustomMarker({
  position,
  num,
  map,
}: {
  position: { lat: number; lng: number };
  num: number;
  map: google.maps.Map | null;
}) {
  const markerRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    if (!map) return;
    markerRef.current = new google.maps.Marker({
      position,
      map,
      icon: {
        url: pinUrl(num),
        scaledSize: new google.maps.Size(34, 44),
        anchor: new google.maps.Point(17, 44),
      },
      zIndex: 100 + num,
    });
    return () => { markerRef.current?.setMap(null); };
  }, [map, position, num]);

  return null;
}

// ─── Itinerary ────────────────────────────────────────────────────────────────

function StopCard({ stop }: { stop: CrawlStop }) {
  return (
    <div className="relative">
      {stop.position > 1 && stop.walking_minutes_from_prev != null && (
        <div className="flex items-center gap-2 my-2 px-1">
          <div className="w-0.5 h-4 bg-[#B34207]/20 mx-auto" style={{ marginLeft: 19 }} />
          <span className="text-[10px] text-stone-400 ml-7">
            🚶 {stop.walking_minutes_from_prev} min · {stop.walking_km_from_prev} km
          </span>
        </div>
      )}

      <div className="flex gap-3">
        {/* Stop number */}
        <div className="shrink-0 w-9 h-9 rounded-full bg-[#B34207] text-white font-black text-sm flex items-center justify-center shadow-[0_0_12px_rgba(179,66,7,0.3)]">
          {stop.position}
        </div>

        {/* Card */}
        <div className="flex-1 bg-white border border-[#fde8c4] hover:border-[#B34207]/30 rounded-xl p-3.5 transition-colors">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-black text-[#1c1917] text-sm leading-tight">{stop.bar.name}</h3>
            <span className="shrink-0 text-[10px] text-stone-400 font-semibold mt-0.5 whitespace-nowrap">
              {stop.arrival_time}
            </span>
          </div>

          {stop.bar.neighbourhood && (
            <p className="text-[11px] text-stone-400 mb-2">{stop.bar.neighbourhood}</p>
          )}

          <div className="flex items-center gap-2 mb-2">
            {stop.active_price != null ? (
              <>
                <span className="text-[#B34207] font-black text-base leading-none">
                  ${Number(stop.active_price).toFixed(2)}
                </span>
                <span className="text-[10px] text-stone-400">cheapest pint</span>
                {stop.is_happy_hour && (
                  <span className="text-[10px] bg-[#F5A623]/10 text-[#b45309] border border-[#F5A623]/25 px-1.5 py-0.5 rounded-full font-bold">
                    🍻 HH
                  </span>
                )}
              </>
            ) : (
              <span className="text-[11px] text-stone-400 italic">No price data</span>
            )}
          </div>

          <p className="text-[11px] text-stone-500 leading-relaxed">{stop.reason}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function CrawlOutput({
  crawl,
  onRebuild,
}: {
  crawl: CrawlResult;
  onRebuild: () => void;
}) {
  const priceStops = crawl.stops.filter(s => s.active_price != null);
  const totalHours = Math.floor(crawl.total_duration_min / 60);
  const totalMins = crawl.total_duration_min % 60;

  return (
    <div className="mt-8">
      {/* Title */}
      <div className="mb-5 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#1c1917] leading-tight">{crawl.title}</h2>
          <p className="text-xs text-stone-400 mt-0.5">
            {crawl.stops.length} stops · {totalHours > 0 ? `${totalHours}h ` : ''}{totalMins > 0 ? `${totalMins}m` : ''} · {crawl.total_walking_km} km on foot
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CrawlPDFExport crawl={crawl} />
          <button
            onClick={onRebuild}
            className="text-xs text-stone-500 hover:text-[#B34207] border border-[#fde8c4] hover:border-[#B34207]/40 px-3 py-1.5 rounded-lg transition-all font-semibold"
          >
            ↺ Rebuild
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-5">
        {/* Map */}
        <div className="lg:w-1/2 h-[340px] sm:h-[420px] lg:h-auto lg:min-h-[500px] rounded-2xl overflow-hidden border border-[#fde8c4]">
          <CrawlMap stops={crawl.stops} />
        </div>

        {/* Itinerary */}
        <div className="lg:w-1/2 flex flex-col">
          <div className="flex-1 space-y-0">
            {crawl.stops.map((stop) => (
              <StopCard key={stop.bar.id} stop={stop} />
            ))}
          </div>

          {/* Totals */}
          <div className="mt-5 pt-4 border-t border-[#fde8c4] grid grid-cols-3 gap-3">
            <div className="bg-white border border-[#fde8c4] rounded-xl p-3 text-center">
              <p className="text-[#B34207] font-black text-lg">
                {priceStops.length > 0 ? `$${crawl.total_spend.toFixed(2)}` : '—'}
              </p>
              <p className="text-[10px] text-stone-400 mt-0.5">
                {priceStops.length > 0 ? `est. spend (${priceStops.length} bars)` : 'no price data'}
              </p>
            </div>
            <div className="bg-white border border-[#fde8c4] rounded-xl p-3 text-center">
              <p className="text-[#B34207] font-black text-lg">{crawl.total_walking_km} km</p>
              <p className="text-[10px] text-stone-400 mt-0.5">total walking</p>
            </div>
            <div className="bg-white border border-[#fde8c4] rounded-xl p-3 text-center">
              <p className="text-[#B34207] font-black text-lg">
                {totalHours > 0 ? `${totalHours}h${totalMins > 0 ? ` ${totalMins}m` : ''}` : `${totalMins}m`}
              </p>
              <p className="text-[10px] text-stone-400 mt-0.5">total night</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
