import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, UserRound, Download, RotateCcw, Palette, X, Sparkles } from "lucide-react";
import { SHIELD_PATH, TIERS, type Tier } from "./engine";

/* ───────── بيانات البطاقة ───────── */
export interface CardInfo {
  name: string; title: string; tier: Tier; score: number; correct: number; total: number;
  modeLabel: string; avatarBg: string;
}

const THEMES = [
  { name: "عنابي", bg: ["#7A1518", "#3A0507"], text: "#FFFFFF", sub: "rgba(255,255,255,.75)", accent: "#F2C879", logo: "/ghirass/logo-white.png", dots: ["#F2C879", "#FFFFFF", "#C9A27A", "#E8857F"] },
  { name: "رملي", bg: ["#FBF6EF", "#E9D6BC"], text: "#2B0A0B", sub: "rgba(43,10,11,.65)", accent: "#600B0D", logo: "/ghirass/logo.png", dots: ["#600B0D", "#C9A27A", "#A8383B", "#059669"] },
  { name: "ليلي", bg: ["#1E1B4B", "#0B1026"], text: "#FFFFFF", sub: "rgba(255,255,255,.7)", accent: "#A5F3FC", logo: "/ghirass/logo-white.png", dots: ["#A5F3FC", "#F0ABFC", "#FDE68A", "#FFFFFF"] },
];
const CAPTIONS = ["كفو!", "عبقري تقني", "مستوى أسطوري", "جاهز للمستقبل", "Ctrl + فوز", "دماغ 5G", "شحن 100%"];

const W = 1080, H = 1350;
const PHOTO = { x: 150, y: 200, w: 780, h: 700 };

type ImgSrc = { el: CanvasImageSource; w: number; h: number } | null;
type Step = "camera" | "choose" | "preview";

type ClaudeWindow = { claude?: { use?: (name: string) => Promise<unknown> } };
type Downloads = { save: (r: { filename: string; data: Blob }) => Promise<unknown> };

/* ───────── أدوات الرسم ───────── */
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.45 : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(cx + rad * Math.cos(a), cy + rad * Math.sin(a));
  }
  ctx.closePath();
}

function sparkle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx, cy, cx + r, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy + r);
  ctx.quadraticCurveTo(cx, cy, cx - r, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy - r);
  ctx.fill();
}

function seeded(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

function fitText(ctx: CanvasRenderingContext2D, text: string, font: (s: number) => string, size: number, maxW: number) {
  let s = size;
  ctx.font = font(s);
  while (s > 20 && ctx.measureText(text).width > maxW) { s -= 4; ctx.font = font(s); }
}

const DISPLAY = (s: number) => `900 ${s}px Cairo, "IBM Plex Sans Arabic", sans-serif`;
const BODY = (s: number, w = 600) => `${w} ${s}px "IBM Plex Sans Arabic", Cairo, sans-serif`;

async function compose(canvas: HTMLCanvasElement, photo: ImgSrc, info: CardInfo, themeIdx: number, caption: string, seed: number) {
  const t = THEMES[themeIdx];
  const tier = TIERS[info.tier];
  try {
    await Promise.all([document.fonts.load(DISPLAY(80)), document.fonts.load(BODY(40)), document.fonts.load(BODY(40, 700))]);
  } catch { /* نستخدم الخط الاحتياطي */ }
  const logo = await loadImage(t.logo);
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // الخلفية
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, t.bg[0]); g.addColorStop(1, t.bg[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // أشعة احتفالية خلف الدرع
  ctx.save();
  ctx.translate(W / 2, 900);
  ctx.globalAlpha = 0.07; ctx.fillStyle = t.accent;
  for (let i = 0; i < 18; i++) {
    ctx.rotate((Math.PI * 2) / 18);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-40, -1100); ctx.lineTo(40, -1100); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // قصاصات ملوّنة
  const rnd = seeded(seed);
  for (let i = 0; i < 70; i++) {
    ctx.save();
    ctx.globalAlpha = 0.35 + rnd() * 0.5;
    ctx.fillStyle = t.dots[i % t.dots.length];
    const x = rnd() * W, y = rnd() * H;
    if (y > 1030 && x > 120 && x < W - 120) { ctx.restore(); continue; } // لا قصاصات فوق النصوص
    ctx.translate(x, y); ctx.rotate(rnd() * Math.PI);
    if (i % 3 === 0) sparkle(ctx, 0, 0, 8 + rnd() * 14);
    else ctx.fillRect(-7, -3, 14 + rnd() * 10, 6);
    ctx.restore();
  }

  // الشعار
  if (logo) {
    const lh = 120, lw = (logo.width / logo.height) * lh;
    ctx.drawImage(logo, (W - lw) / 2, 40, lw, lh);
  }

  // الصورة بإطار بولارويد مائل قليلاً
  ctx.save();
  ctx.translate(W / 2, PHOTO.y + PHOTO.h / 2);
  ctx.rotate(-0.03);
  ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16;
  ctx.fillStyle = "#FFFFFF";
  rr(ctx, -PHOTO.w / 2 - 18, -PHOTO.h / 2 - 18, PHOTO.w + 36, PHOTO.h + 36, 36); ctx.fill();
  ctx.shadowColor = "transparent";
  rr(ctx, -PHOTO.w / 2, -PHOTO.h / 2, PHOTO.w, PHOTO.h, 24); ctx.save(); ctx.clip();
  if (photo) {
    const s = Math.max(PHOTO.w / photo.w, PHOTO.h / photo.h);
    const dw = photo.w * s, dh = photo.h * s;
    ctx.drawImage(photo.el, -dw / 2, -dh / 2 - (dh - PHOTO.h) * 0.15, dw, dh);
  } else {
    ctx.fillStyle = info.avatarBg; ctx.fillRect(-PHOTO.w / 2, -PHOTO.h / 2, PHOTO.w, PHOTO.h);
    ctx.fillStyle = "rgba(255,255,255,.12)";
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(0, -40, 120 + i * 70, 0, Math.PI * 2); ctx.lineWidth = 18; ctx.strokeStyle = "rgba(255,255,255,.07)"; ctx.stroke(); }
    ctx.fillStyle = "#FFFFFF"; ctx.font = DISPLAY(300);
    ctx.fillText((info.name.trim()[0] || "؟").toUpperCase(), 0, -60);
  }
  ctx.restore();
  ctx.restore();

  // ملصق مرح مائل
  ctx.save();
  ctx.translate(PHOTO.x + 90, PHOTO.y + 70);
  ctx.rotate(-0.16);
  ctx.font = DISPLAY(54);
  const cw = ctx.measureText(caption).width + 70;
  ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
  ctx.fillStyle = t.accent; rr(ctx, -cw / 2, -48, cw, 96, 48); ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = themeIdx === 1 ? "#FFFFFF" : "#2B0A0B";
  ctx.fillText(caption, 0, 4);
  ctx.restore();
  // نجوم صغيرة حول الصورة
  ctx.fillStyle = t.accent;
  [[PHOTO.x + PHOTO.w + 10, PHOTO.y + 40, 34], [PHOTO.x + PHOTO.w - 40, PHOTO.y - 10, 20], [PHOTO.x - 10, PHOTO.y + PHOTO.h - 60, 26]]
    .forEach(([x, y, r]) => sparkle(ctx, x, y, r));

  // الدرع
  const S = 250, sx = W / 2 - S / 2, sy = 790;
  ctx.save();
  ctx.translate(sx, sy); ctx.scale(S / 100, S / 100);
  const path = new Path2D(SHIELD_PATH);
  ctx.shadowColor = "rgba(0,0,0,.4)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
  const sg = ctx.createLinearGradient(0, 0, 100, 100);
  sg.addColorStop(0, tier.light); sg.addColorStop(1, tier.dark);
  ctx.fillStyle = sg; ctx.fill(path);
  ctx.shadowColor = "transparent";
  ctx.lineWidth = 4; ctx.strokeStyle = "#FFFFFF"; ctx.stroke(path);
  ctx.save(); ctx.translate(50, 50); ctx.scale(0.8, 0.8); ctx.translate(-50, -50);
  ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.stroke(path); ctx.restore();
  ctx.restore();
  // نجوم الدرع حسب المستوى
  const n = info.tier + 1;
  ctx.fillStyle = tier.ink;
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 46;
    star(ctx, W / 2 + off, sy + S * 0.48, n > 2 ? 22 : 30); ctx.fill();
  }
  ctx.font = DISPLAY(30); ctx.fillStyle = tier.ink;
  ctx.fillText(info.score.toLocaleString("en"), W / 2, sy + S * 0.74);

  // النصوص
  ctx.fillStyle = t.accent; ctx.font = BODY(36, 700);
  ctx.fillText(tier.name, W / 2, 1080);
  ctx.fillStyle = t.text;
  fitText(ctx, info.title, DISPLAY, 92, W - 160);
  ctx.fillText(info.title, W / 2, 1150);
  ctx.fillStyle = t.sub;
  const line = `${info.name} · ${info.correct}/${info.total} إجابات صحيحة · ${info.modeLabel}`;
  fitText(ctx, line, (s) => BODY(s), 38, W - 140);
  ctx.fillText(line, W / 2, 1222);
  ctx.font = BODY(26, 500); ctx.fillStyle = t.sub;
  ctx.fillText(`تحدّي غراس التقني · ${new Date().toLocaleDateString("ar-SA-u-nu-latn", { day: "numeric", month: "long", year: "numeric" })}`, W / 2, 1295);
}

/* ───────── المكوّن ───────── */
export default function PhotoBooth({ info, onClose, mute }: { info: CardInfo; onClose: () => void; mute: boolean }) {
  const [step, setStep] = useState<Step>("camera");
  const [count, setCount] = useState(0);
  const [flash, setFlash] = useState(false);
  const [photo, setPhoto] = useState<ImgSrc>(null);
  const [theme, setTheme] = useState(0);
  const [caption, setCaption] = useState(() => CAPTIONS[Math.floor(Math.random() * CAPTIONS.length)]);
  const [seed, setSeed] = useState(() => Date.now());
  const [url, setUrl] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [canSave, setCanSave] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement("canvas"));
  const downloadsRef = useRef<Downloads | null | undefined>(undefined);
  const inArtifact = typeof window !== "undefined" && !!(window as unknown as ClaudeWindow).claude?.use;

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setStep("camera");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
    } catch {
      setStep("choose"); // الكاميرا غير متاحة هنا: نعرض خيار فتح الكاميرا عبر الجهاز أو بدون صورة
    }
  }, []);

  useEffect(() => {
    void startCamera();
    const cw = (window as unknown as ClaudeWindow).claude;
    if (cw?.use) cw.use("downloads").then((d) => { downloadsRef.current = d as Downloads | null; }).catch(() => { downloadsRef.current = null; });
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  // إعادة رسم البطاقة عند أي تغيير
  useEffect(() => {
    if (step !== "preview") return;
    let alive = true;
    compose(canvasRef.current, photo, info, theme, caption, seed).then(() => {
      if (alive) setUrl(canvasRef.current.toDataURL("image/jpeg", 0.92));
    });
    return () => { alive = false; };
  }, [step, photo, info, theme, caption, seed]);

  const beep = (f: number, d = 0.12) => {
    if (mute) return;
    try {
      const ctx = new AudioContext(); const o = ctx.createOscillator(); const gn = ctx.createGain();
      o.frequency.value = f; gn.gain.setValueAtTime(0.15, ctx.currentTime); gn.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d);
      o.connect(gn).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + d);
    } catch { /* لا صوت */ }
  };

  const snap = () => {
    if (count) return;
    let n = 3; setCount(n); beep(600);
    const iv = setInterval(() => {
      n -= 1;
      if (n > 0) { setCount(n); beep(600); return; }
      clearInterval(iv); setCount(0);
      const v = videoRef.current;
      if (!v || !v.videoWidth) return;
      const c = document.createElement("canvas");
      c.width = v.videoWidth; c.height = v.videoHeight;
      const cx = c.getContext("2d")!;
      cx.translate(c.width, 0); cx.scale(-1, 1); // صورة سيلفي كالمرآة
      cx.drawImage(v, 0, 0);
      setFlash(true); setTimeout(() => setFlash(false), 350); beep(1400, 0.08);
      setPhoto({ el: c, w: c.width, h: c.height });
      stopCamera();
      setStep("preview");
    }, 900);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const img = await loadImage(URL.createObjectURL(f));
    if (!img) return;
    stopCamera();
    setPhoto({ el: img, w: img.naturalWidth, h: img.naturalHeight });
    setStep("preview");
  };

  const noPhoto = () => { stopCamera(); setPhoto(null); setStep("preview"); };

  const retake = () => { setUrl(null); setSaveMsg(null); void startCamera(); };

  const save = async () => {
    setSaveMsg(null);
    const blob: Blob | null = await new Promise((r) => canvasRef.current.toBlob(r, "image/png"));
    if (!blob) return;
    const filename = `ghirass-quiz-${info.score}.png`;
    if (inArtifact) {
      if (downloadsRef.current === undefined) {
        try { downloadsRef.current = (await (window as unknown as ClaudeWindow).claude!.use!("downloads")) as Downloads | null; }
        catch { downloadsRef.current = null; }
      }
      const dl = downloadsRef.current;
      if (!dl) { setCanSave(false); setSaveMsg("اضغط مطولاً على الصورة واختر «حفظ الصورة»."); return; }
      try { await dl.save({ filename, data: blob }); setSaveMsg("تم حفظ الصورة!"); }
      catch (e) {
        const code = (e as { code?: string })?.code;
        if (code === "declined") return;
        setCanSave(false); setSaveMsg("اضغط مطولاً على الصورة واختر «حفظ الصورة».");
      }
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setSaveMsg("تم حفظ الصورة!");
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#2B0A0B]/70 backdrop-blur-sm grid place-items-center p-3 sm:p-6 quiz-fade" role="dialog" aria-modal="true" aria-label="صورة الفوز">
      <div className="relative w-full max-w-3xl max-h-full overflow-y-auto rounded-3xl bg-[#FBF6EF] p-4 sm:p-6 shadow-2xl quiz-pop">
        <button onClick={() => { stopCamera(); onClose(); }} aria-label="إغلاق"
          className="absolute left-3 top-3 z-10 w-10 h-10 rounded-xl bg-white border border-[#600B0D]/10 grid place-items-center hover:bg-[#600B0D]/5">
          <X className="w-5 h-5" />
        </button>
        <h3 className="font-display font-black text-2xl sm:text-3xl text-[#600B0D] mb-1 flex items-center gap-2">
          <Sparkles className="w-7 h-7" /> صورة الفوز
        </h3>
        <p className="text-[#2B0A0B]/60 mb-4">صورتك مع {TIERS[info.tier].name} ونتيجتك، جاهزة للمشاركة!</p>

        {step === "camera" && (
          <div>
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3] max-h-[60vh] mx-auto">
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover -scale-x-100" />
              {/* إطار توجيهي */}
              <div className="pointer-events-none absolute inset-6 rounded-3xl border-4 border-white/60 border-dashed" />
              <div className="pointer-events-none absolute top-3 inset-x-0 text-center">
                <span className="inline-block rounded-full bg-black/50 text-white px-4 py-1.5 text-sm">ابتسم! وجهك داخل الإطار</span>
              </div>
              {count > 0 && (
                <div key={count} className="absolute inset-0 grid place-items-center">
                  <span className="quiz-count font-display font-black text-white text-[9rem] drop-shadow-[0_4px_20px_rgba(0,0,0,.6)]">{count}</span>
                </div>
              )}
              {flash && <div className="absolute inset-0 bg-white quiz-flash" />}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 justify-center">
              <button onClick={snap} disabled={count > 0}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#600B0D] text-white font-display font-black text-xl px-8 py-4 hover:bg-[#7A1518] active:scale-95 transition disabled:opacity-60">
                <Camera className="w-6 h-6" /> التقط الصورة
              </button>
              <button onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-2xl border-2 border-[#600B0D]/20 font-bold px-5 py-4 hover:bg-[#600B0D]/5 transition">
                <ImagePlus className="w-5 h-5" /> من الصور
              </button>
              <button onClick={noPhoto}
                className="inline-flex items-center gap-2 rounded-2xl border-2 border-[#600B0D]/20 font-bold px-5 py-4 hover:bg-[#600B0D]/5 transition">
                <UserRound className="w-5 h-5" /> بدون صورة
              </button>
            </div>
          </div>
        )}

        {step === "choose" && (
          <div className="grid sm:grid-cols-2 gap-3">
            <button onClick={() => fileRef.current?.click()}
              className="rounded-3xl bg-[#600B0D] text-white p-6 text-right hover:bg-[#7A1518] active:scale-[0.98] transition">
              <Camera className="w-10 h-10 mb-3" />
              <span className="block font-display font-black text-2xl">افتح الكاميرا</span>
              <span className="block text-white/70 mt-1">التقط سيلفي أو اختر صورة من جوالك</span>
            </button>
            <button onClick={noPhoto}
              className="rounded-3xl border-2 border-[#600B0D]/20 bg-white p-6 text-right hover:bg-[#600B0D]/5 active:scale-[0.98] transition">
              <UserRound className="w-10 h-10 mb-3 text-[#600B0D]" />
              <span className="block font-display font-black text-2xl text-[#600B0D]">بطاقة بدون صورة</span>
              <span className="block text-[#2B0A0B]/60 mt-1">نستخدم أول حرف من اسمك</span>
            </button>
          </div>
        )}

        {step === "preview" && (
          <div className="grid sm:grid-cols-[minmax(0,1fr)_14rem] gap-4 items-start">
            <div className="rounded-2xl overflow-hidden bg-white shadow-lg aspect-[4/5] grid place-items-center">
              {url ? <img src={url} alt="صورة الفوز" className="w-full h-full object-contain select-auto quiz-pop" style={{ WebkitTouchCallout: "default" }} />
                : <span className="w-10 h-10 border-4 border-[#600B0D] border-t-transparent rounded-full animate-spin" />}
            </div>
            <div className="flex flex-col gap-2.5">
              {canSave && (
                <button onClick={save} disabled={!url}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#600B0D] text-white font-display font-black text-lg px-5 py-4 hover:bg-[#7A1518] active:scale-95 transition disabled:opacity-50">
                  <Download className="w-5 h-5" /> حفظ الصورة
                </button>
              )}
              {saveMsg && <p className="rounded-xl bg-white border border-[#600B0D]/10 px-3 py-2 text-sm font-semibold text-[#600B0D]">{saveMsg}</p>}
              <button onClick={() => { setTheme((n) => (n + 1) % THEMES.length); setSeed(Date.now()); }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-[#600B0D]/20 bg-white font-bold px-5 py-3 hover:bg-[#600B0D]/5 transition">
                <Palette className="w-5 h-5" /> غيّر الستايل
              </button>
              <button onClick={() => setCaption((c) => CAPTIONS[(CAPTIONS.indexOf(c) + 1) % CAPTIONS.length])}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-[#600B0D]/20 bg-white font-bold px-5 py-3 hover:bg-[#600B0D]/5 transition">
                <Sparkles className="w-5 h-5" /> ملصق آخر
              </button>
              <button onClick={retake}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-[#600B0D]/20 bg-white font-bold px-5 py-3 hover:bg-[#600B0D]/5 transition">
                <RotateCcw className="w-5 h-5" /> صورة جديدة
              </button>
              <p className="text-xs text-[#2B0A0B]/45 leading-relaxed">على الجوال تقدر بعد تضغط مطولاً على الصورة لحفظها أو مشاركتها.</p>
            </div>
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden"
          onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
    </div>
  );
}
