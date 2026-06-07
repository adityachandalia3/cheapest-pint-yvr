'use client';

import { useState, useCallback, useRef } from 'react';
import { Bar } from './types';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface NearMeState {
  isActive: boolean;
  isLoading: boolean;
  userLocation: { lat: number; lng: number } | null;
  nearbyBarIds: Set<string> | null; // null = all-Vancouver fallback
  radiusKm: number | null;          // radius used; null = all-Vancouver fallback
  expandedFrom: number | null;      // 1 if we had to expand beyond 1km, else null
  barCount: number;
  toast: string | null;
  toggle: () => void;
}

export function useNearMe(bars: Bar[]): NearMeState {
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyBarIds, setNearbyBarIds] = useState<Set<string> | null>(null);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [expandedFrom, setExpandedFrom] = useState<number | null>(null);
  const [barCount, setBarCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const deactivate = useCallback(() => {
    setIsActive(false);
    setIsLoading(false);
    setUserLocation(null);
    setNearbyBarIds(null);
    setRadiusKm(null);
    setExpandedFrom(null);
    setBarCount(0);
  }, []);

  const activate = useCallback(() => {
    if (!navigator?.geolocation) {
      showToast('Location access needed for Near Me');
      return;
    }

    setIsLoading(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: userLat, longitude: userLng } = pos.coords;
        setUserLocation({ lat: userLat, lng: userLng });


        let chosen: { ids: Set<string>; radius: number } | null = null;
        for (const r of [1, 2, 5]) {
          const ids = new Set<string>();
          for (const bar of bars) {
            if (bar.latitude === null || bar.longitude === null) continue;
            if (haversineKm(userLat, userLng, bar.latitude, bar.longitude) <= r) {
              ids.add(bar.id);
            }
          }
          if (ids.size >= 5) {
            chosen = { ids, radius: r };
            break;
          }
        }

        if (chosen === null) {
          setNearbyBarIds(null);
          setRadiusKm(null);
          setExpandedFrom(null);
          setBarCount(bars.length);
        } else {
          setNearbyBarIds(chosen.ids);
          setRadiusKm(chosen.radius);
          setExpandedFrom(chosen.radius > 1 ? 1 : null);
          setBarCount(chosen.ids.size);
        }

        setIsLoading(false);
        setIsActive(true);
      },
      (err) => {
        console.error('[useNearMe] geolocation error:', err.code, err.message);
        showToast('Location access needed for Near Me');
        setIsLoading(false);
        setIsActive(false);
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 },
    );
  }, [bars, showToast]);

  const toggle = useCallback(() => {
    if (isActive || isLoading) {
      deactivate();
    } else {
      activate();
    }
  }, [isActive, isLoading, activate, deactivate]);

  return { isActive, isLoading, userLocation, nearbyBarIds, radiusKm, expandedFrom, barCount, toast, toggle };
}
