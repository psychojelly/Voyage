'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { WeatherDay, WeatherHourly, Settings } from '@/lib/types';

interface UseWeatherOptions {
  startStr: string;
  endStr: string;
  focusDate: string;
  settings: Settings;
}

interface UseWeatherReturn {
  daily: WeatherDay[];
  hourly: WeatherHourly | null;
  loading: boolean;
  error: string | null;
  location: { lat: number; lon: number } | null;
  locationLabel: string;
  detectLocation: () => void;
}

export function useWeather({ startStr, endStr, focusDate, settings }: UseWeatherOptions): UseWeatherReturn {
  const [daily, setDaily] = useState<WeatherDay[]>([]);
  const [hourly, setHourly] = useState<WeatherHourly | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoLocation, setGeoLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  // Resolve effective location: settings override > geolocation
  const hasManual = settings.weatherLat != null && settings.weatherLon != null;
  const effectiveLat = hasManual ? settings.weatherLat! : geoLocation?.lat;
  const effectiveLon = hasManual ? settings.weatherLon! : geoLocation?.lon;
  const hasLocation = effectiveLat != null && effectiveLon != null;

  // Auto-detect geolocation on mount if no manual override
  useEffect(() => {
    if (hasManual) {
      setLocationLabel(settings.weatherCity || `${settings.weatherLat!.toFixed(2)}, ${settings.weatherLon!.toFixed(2)}`);
      return;
    }
    detectLocationInner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasManual, settings.weatherLat, settings.weatherLon, settings.weatherCity]);

  function detectLocationInner() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Geolocation not supported by this browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setGeoLocation(loc);
        setLocationLabel(`${loc.lat.toFixed(2)}, ${loc.lon.toFixed(2)}`);
        setError(null);
      },
      (err) => {
        setError(`Location access denied: ${err.message}`);
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }

  const detectLocation = useCallback(() => {
    detectLocationInner();
  }, []);

  // Fetch weather data when location or date range changes
  useEffect(() => {
    if (!hasLocation) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      lat: String(effectiveLat),
      lon: String(effectiveLon),
      start: startStr,
      end: endStr,
      focus: focusDate,
    });

    fetch(`/api/weather?${params}`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error('Weather fetch failed');
        return res.json();
      })
      .then(data => {
        setDaily(data.daily || []);
        setHourly(data.hourly || null);
        setLoading(false);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setError(err.message);
        setLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveLat, effectiveLon, startStr, endStr, focusDate]);

  return {
    daily,
    hourly,
    loading,
    error,
    location: hasLocation ? { lat: effectiveLat!, lon: effectiveLon! } : null,
    locationLabel,
    detectLocation,
  };
}
