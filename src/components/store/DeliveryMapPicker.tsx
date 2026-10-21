import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, CircleMarker } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

import type { DeliveryPoint } from '@/lib/deliveryLocation';

// The store's own colour for the pin (--store-primary holds "h s% l%")
const pinColour = () => {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--store-primary').trim();
  return v ? `hsl(${v})` : '#f97316';
};

// Riyadh, until the customer shows us where they are
const DEFAULT_CENTER: [number, number] = [24.7136, 46.6753];

/**
 * The customer taps where the order should go. OpenStreetMap tiles through
 * Leaflet — no API key. Loaded with the checkout page only.
 */
export function DeliveryMapPicker({
  value,
  onChange,
}: {
  value: DeliveryPoint | null;
  onChange: (point: DeliveryPoint) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<CircleMarker | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');

  // The map keeps the latest handler without being rebuilt for it
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import('leaflet');
      if (cancelled || !box.current || map.current) return;

      const m = L.map(box.current, { zoomControl: true, attributionControl: true })
        .setView(value ? [value.lat, value.lng] : DEFAULT_CENTER, value ? 16 : 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(m);

      // A drawn circle needs no marker image, so nothing breaks in the bundle
      const place = (lat: number, lng: number) => {
        if (marker.current) marker.current.setLatLng([lat, lng]);
        else {
          marker.current = L.circleMarker([lat, lng], {
            radius: 10, weight: 3, color: '#ffffff', fillColor: pinColour(), fillOpacity: 1,
          }).addTo(m);
        }
      };
      if (value) place(value.lat, value.lng);

      m.on('click', (e) => {
        place(e.latlng.lat, e.latlng.lng);
        onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
      map.current = m;
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // built once; later picks move the marker from inside the map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locateMe = () => {
    if (!navigator.geolocation) { setLocateError('المتصفح لا يدعم تحديد الموقع'); return; }
    setLocating(true);
    setLocateError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const L = await import('leaflet');
        if (map.current) {
          map.current.setView([point.lat, point.lng], 17);
          if (marker.current) marker.current.setLatLng([point.lat, point.lng]);
          else {
            marker.current = L.circleMarker([point.lat, point.lng], {
              radius: 10, weight: 3, color: '#ffffff', fillColor: pinColour(), fillOpacity: 1,
            }).addTo(map.current);
          }
        }
        onChangeRef.current(point);
        setLocating(false);
      },
      () => {
        setLocateError('تعذر تحديد موقعك — اسمح بالوصول للموقع أو اختر على الخريطة');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <MapPin className="w-4 h-4" /> اضغط على الخريطة لتحديد مكان التوصيل
        </p>
        <Button type="button" variant="outline" size="sm" onClick={locateMe} disabled={locating} className="gap-1.5 shrink-0">
          {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
          موقعي الحالي
        </Button>
      </div>
      {/* Leaflet lays its tiles left-to-right whatever the page direction */}
      <div ref={box} dir="ltr" className="h-64 w-full rounded-xl border overflow-hidden z-0" />
      {value ? (
        <p className="text-xs text-muted-foreground" dir="ltr">
          📍 {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">لم يُحدد موقع بعد (اختياري)</p>
      )}
      {locateError && <p className="text-xs text-destructive">{locateError}</p>}
    </div>
  );
}
