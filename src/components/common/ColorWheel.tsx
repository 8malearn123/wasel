import { useRef, useState, useEffect } from 'react';

// عجلة ألوان HSL كاملة: الزاوية = درجة اللون، البعد عن المركز = التشبع،
// وشريط تحتها للإضاءة — بدون أي مكتبات خارجية

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let c = (hex || '').replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(c)) return { h: 220, s: 80, l: 50 };
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100, ln = l / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const col = ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(col * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

interface ColorWheelProps {
  value: string;
  onChange: (hex: string) => void;
  size?: number;
}

export function ColorWheel({ value, onChange, size = 220 }: ColorWheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const { h, s, l } = hexToHsl(value);
  const [lightness, setLightness] = useState(l || 50);

  // مزامنة الإضاءة إذا تغير اللون من خارج العجلة (قوالب جاهزة / كتابة hex)
  useEffect(() => {
    const parsed = hexToHsl(value);
    setLightness(parsed.l || 50);
  }, [value]);

  const pick = (clientX: number, clientY: number) => {
    const el = wheelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const radius = rect.width / 2;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), radius);
    const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
    const sat = Math.round((dist / radius) * 100);
    onChange(hslToHex(Math.round(angle), sat, lightness));
  };

  // موضع مؤشر اللون الحالي على العجلة
  const markerAngle = ((h - 90) * Math.PI) / 180;
  const markerR = (s / 100) * (size / 2 - 10);
  const markerX = size / 2 + Math.cos(markerAngle) * markerR;
  const markerY = size / 2 + Math.sin(markerAngle) * markerR;

  return (
    <div className="flex flex-col items-center gap-4 select-none" style={{ width: size }}>
      <div
        ref={wheelRef}
        className="relative rounded-full cursor-crosshair shadow-inner border"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle, white 0%, rgba(255,255,255,0) 70%),
            conic-gradient(from 0deg, red, yellow, lime, cyan, blue, magenta, red)`,
          touchAction: 'none',
        }}
        onPointerDown={e => {
          draggingRef.current = true;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          pick(e.clientX, e.clientY);
        }}
        onPointerMove={e => { if (draggingRef.current) pick(e.clientX, e.clientY); }}
        onPointerUp={() => { draggingRef.current = false; }}
        onPointerCancel={() => { draggingRef.current = false; }}
      >
        <div
          className="absolute w-5 h-5 rounded-full border-[3px] border-white shadow-md pointer-events-none -translate-x-1/2 -translate-y-1/2"
          style={{ left: markerX, top: markerY, background: value }}
        />
      </div>

      {/* شريط الإضاءة */}
      <div className="w-full">
        <input
          type="range"
          min={10}
          max={90}
          value={lightness}
          onChange={e => {
            const newL = Number(e.target.value);
            setLightness(newL);
            onChange(hslToHex(h, s, newL));
          }}
          className="w-full h-3 rounded-full appearance-none cursor-pointer border"
          style={{
            background: `linear-gradient(to right, hsl(${h},${s}%,10%), hsl(${h},${s}%,50%), hsl(${h},${s}%,90%))`,
          }}
        />
        <p className="text-[11px] text-muted-foreground text-center mt-1">الإضاءة — غامق / فاتح</p>
      </div>
    </div>
  );
}
