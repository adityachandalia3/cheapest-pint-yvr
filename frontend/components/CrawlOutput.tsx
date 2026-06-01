'use client';

import { useEffect, useRef, useState } from 'react';
import { GoogleMap, DirectionsRenderer, useJsApiLoader } from '@react-google-maps/api';
import type { CrawlResult, CrawlStop } from '@/app/api/crawl-builder/route';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1d2236' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1d2236' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a9bb0' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d3748' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3d4e6b' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f1929' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2d3748' }] },
];

// ─── Numbered pin SVG ─────────────────────────────────────────────────────────

function pinUrl(num: number, highlight = false): string {
  const bg = highlight ? '#ffffff' : '#F5A623';
  const fg = '#0d0d1a';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">
    <path d="M17 0C8.163 0 1 7.163 1 16c0 9.5 16 28 16 28S33 25.5 33 16C33 7.163 25.837 0 17 0z" fill="${bg}" stroke="#0d0d1a" stroke-width="1.5"/>
    <circle cx="17" cy="16" r="9" fill="${fg}"/>
    <text x="17" y="21" text-anchor="middle" fill="${bg}" font-family="Arial Black, Arial, sans-serif" font-size="11" font-weight="900">${num}</text>
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
        if (status === 'OK' && result) {
          setDirections(result);
        } else {
          setDirectionsError(true);
        }
      }
    );
  }, [isLoaded, stops]);

  // Fit bounds to all stop markers
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
      <div className="w-full h-full flex items-center justify-center bg-[#1d2236] rounded-2xl">
        <span className="text-gray-500 text-sm animate-pulse">Loading map...</span>
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
      {directions && (
        <DirectionsRenderer
          directions={directions}
          options={{
            suppressMarkers: true,
            polylineOptions: {
              strokeColor: '#F5A623',
              strokeWeight: 5,
              strokeOpacity: 0.85,
            },
          }}
        />
      )}

      {/* Custom numbered pins — rendered via OverlayView equivalent using google.maps.Marker */}
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

// Use imperative google.maps.Marker so we can set custom SVG icon
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

// ─── Itinerary ─────────────────────────────────────────────────────────────────

function StopCard({ stop, isLast }: { stop: CrawlStop; isLast: boolean }) {
  return (
    <div className="relative">
      {/* Walking connector */}
      {stop.position > 1 && stop.walking_minutes_from_prev != null && (
        <div className="flex items-center gap-2 my-2 px-1">
          <div className="w-0.5 h-4 bg-[#F5A623]/20 mx-auto" style={{ marginLeft: 19 }} />
          <span className="text-[10px] text-[#F5A623]/50 ml-7">
            🚶 {stop.walking_minutes_from_prev} min · {stop.walking_km_from_prev} km
          </span>
        </div>
      )}

      <div className="flex gap-3">
        {/* Stop number */}
        <div className="shrink-0 w-9 h-9 rounded-full bg-[#F5A623] text-[#0d0d1a] font-black text-sm flex items-center justify-center shadow-[0_0_12px_rgba(245,166,35,0.4)]">
          {stop.position}
        </div>

        {/* Card */}
        <div className="flex-1 bg-[#16213e] border border-[#F5A623]/10 hover:border-[#F5A623]/25 rounded-xl p-3.5 transition-colors">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-black text-white text-sm leading-tight">{stop.bar.name}</h3>
            <span className="shrink-0 text-[10px] text-[#F5A623]/50 font-semibold mt-0.5 whitespace-nowrap">
              {stop.arrival_time}
            </span>
          </div>

          {stop.bar.neighbourhood && (
            <p className="text-[11px] text-gray-600 mb-2">{stop.bar.neighbourhood}</p>
          )}

          {/* Price row */}
          <div className="flex items-center gap-2 mb-2">
            {stop.active_price != null ? (
              <>
                <span className="text-[#F5A623] font-black text-base leading-none">
                  ${Number(stop.active_price).toFixed(2)}
                </span>
                <span className="text-[10px] text-gray-600">cheapest pint</span>
                {stop.is_happy_hour && (
                  <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded-full font-bold">
                    🍻 HH
                  </span>
                )}
              </>
            ) : (
              <span className="text-[11px] text-gray-600 italic">No price data</span>
            )}
          </div>

          {/* Reason */}
          <p className="text-[11px] text-white/50 leading-relaxed">{stop.reason}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

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
          <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">{crawl.title}</h2>
          <p className="text-xs text-gray-600 mt-0.5">
            {crawl.stops.length} stops · {totalHours > 0 ? `${totalHours}h ` : ''}{totalMins > 0 ? `${totalMins}m` : ''} · {crawl.total_walking_km} km on foot
          </p>
        </div>
        <button
          onClick={onRebuild}
          className="text-xs text-[#F5A623]/60 hover:text-[#F5A623] border border-[#F5A623]/20 hover:border-[#F5A623]/50 px-3 py-1.5 rounded-lg transition-all font-semibold shrink-0"
        >
          ↺ Rebuild
        </button>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-5">

        {/* Map */}
        <div className="lg:w-1/2 h-[340px] sm:h-[420px] lg:h-auto lg:min-h-[500px] rounded-2xl overflow-hidden border border-[#F5A623]/10">
          <CrawlMap stops={crawl.stops} />
        </div>

        {/* Itinerary */}
        <div className="lg:w-1/2 flex flex-col">
          <div className="flex-1 space-y-0">
            {crawl.stops.map((stop, i) => (
              <StopCard key={stop.bar.id} stop={stop} isLast={i === crawl.stops.length - 1} />
            ))}
          </div>

          {/* Totals */}
          <div className="mt-5 pt-4 border-t border-[#F5A623]/10 grid grid-cols-3 gap-3">
            <div className="bg-[#16213e] rounded-xl p-3 text-center">
              <p className="text-[#F5A623] font-black text-lg">
                {priceStops.length > 0 ? `$${crawl.total_spend.toFixed(2)}` : '—'}
              </p>
              <p className="text-[10px] text-gray-600 mt-0.5">
                {priceStops.length > 0
                  ? `est. spend (${priceStops.length} bars)`
                  : 'no price data'}
              </p>
            </div>
            <div className="bg-[#16213e] rounded-xl p-3 text-center">
              <p className="text-[#F5A623] font-black text-lg">{crawl.total_walking_km} km</p>
              <p className="text-[10px] text-gray-600 mt-0.5">total walking</p>
            </div>
            <div className="bg-[#16213e] rounded-xl p-3 text-center">
              <p className="text-[#F5A623] font-black text-lg">
                {totalHours > 0 ? `${totalHours}h${totalMins > 0 ? ` ${totalMins}m` : ''}` : `${totalMins}m`}
              </p>
              <p className="text-[10px] text-gray-600 mt-0.5">total night</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
