import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Trophy, Timer, Zap, Check, X, Play, RotateCcw, Maximize, Minimize,
  Volume2, VolumeX, Flame, Medal, Trash2, ChevronLeft, Brain,
} from "lucide-react";
import {
  QUESTIONS, CATEGORY_LABELS, LEVEL_LABELS, type QuizQuestion,
} from "./quiz/questions";

/* ───────── إعدادات اللعبة ───────── */
const QUESTION_SECONDS = 20;
const PICK_PER_LEVEL = { 1: 4, 2: 4, 3: 2 } as const; // 10 أسئلة لكل جولة
const AUTO_NEXT_MS = 7000;
const RESULT_IDLE_MS = 45000;
const LB_KEY = "wasel-quiz-leaderboard";
const LETTERS = ["أ", "ب", "ج", "د"];

interface RoundQuestion extends QuizQuestion {
  shuffled: string[];
  correctIndex: number;
}
interface ScoreEntry { name: string; score: number; correct: number; total: number; at: number }
type Phase = "welcome" | "playing" | "result";

/* ───────── أدوات ───────── */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildRound(): RoundQuestion[] {
  const picked: QuizQuestion[] = [];
  ([1, 2, 3] as const).forEach((lvl) => {
    picked.push(...shuffle(QUESTIONS.filter((q) => q.level === lvl)).slice(0, PICK_PER_LEVEL[lvl]));
  });
  return picked.map((q) => {
    const shuffled = shuffle(q.options);
    return { ...q, shuffled, correctIndex: shuffled.indexOf(q.options[0]) };
  });
}

function loadBoard(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(LB_KEY);
    return raw ? (JSON.parse(raw) as ScoreEntry[]) : [];
  } catch {
    return [];
  }
}
function saveBoard(board: ScoreEntry[]) {
  try { localStorage.setItem(LB_KEY, JSON.stringify(board)); } catch { /* وضع التصفح الخاص */ }
}

/* أصوات بسيطة عبر Web Audio — لا تحتاج ملفات */
let audioCtx: AudioContext | null = null;
function beep(freqs: number[], dur = 0.12, type: OscillatorType = "sine") {
  try {
    audioCtx ??= new AudioContext();
    const ctx = audioCtx;
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = f;
      const t = ctx.currentTime + i * dur;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    });
  } catch { /* المتصفح لا يدعم الصوت */ }
}
const SFX = {
  correct: () => beep([660, 880, 1320], 0.1),
  wrong: () => beep([220, 160], 0.18, "square"),
  tick: () => beep([1000], 0.05, "triangle"),
  start: () => beep([523, 659, 784], 0.09),
  win: () => beep([523, 659, 784, 1047, 1319], 0.12),
};

function rankTitle(pct: number) {
  if (pct >= 90) return { title: "عبقري التقنية", sub: "أداء أسطوري! أنت من نخبة الخبراء." };
  if (pct >= 70) return { title: "خبير تقني", sub: "معرفة ممتازة، اقتربت من القمة." };
  if (pct >= 50) return { title: "متحمّس للتقنية", sub: "بداية قوية، استمر في التعلّم." };
  return { title: "مستكشف جديد", sub: "كل خبير كان مبتدئاً يوماً ما. جرّب مرة أخرى!" };
}

/* ───────── الصفحة ───────── */
export default function QuizPage() {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [name, setName] = useState("");
  const [round, setRound] = useState<RoundQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null); // -1 = انتهى الوقت
  const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [gain, setGain] = useState<number | null>(null);
  const [board, setBoard] = useState<ScoreEntry[]>(loadBoard);
  const [lastAt, setLastAt] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [isFs, setIsFs] = useState(false);

  const sfx = useCallback((k: keyof typeof SFX) => { if (!muted) SFX[k](); }, [muted]);
  const current = round[idx];
  const answered = picked !== null;

  useEffect(() => {
    document.title = "تحدّي وصل التقني";
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const start = () => {
    setRound(buildRound());
    setIdx(0); setPicked(null); setTimeLeft(QUESTION_SECONDS);
    setScore(0); setCorrect(0); setStreak(0); setGain(null);
    setPhase("playing");
    sfx("start");
  };

  const finish = useCallback(() => {
    const entry: ScoreEntry = {
      name: name.trim() || "زائر",
      score, correct, total: round.length, at: Date.now(),
    };
    const next = [...loadBoard(), entry].sort((a, b) => b.score - a.score || a.at - b.at).slice(0, 50);
    saveBoard(next);
    setBoard(next);
    setLastAt(entry.at);
    setPhase("result");
    sfx("win");
  }, [name, score, correct, round.length, sfx]);

  const answer = useCallback((choice: number) => {
    if (!current || picked !== null) return;
    setPicked(choice);
    if (choice === current.correctIndex) {
      const newStreak = streak + 1;
      const pts = current.level * 100 + timeLeft * 5 + (newStreak >= 3 ? 50 : 0);
      setScore((s) => s + pts);
      setCorrect((c) => c + 1);
      setStreak(newStreak);
      setGain(pts);
      sfx("correct");
    } else {
      setStreak(0);
      setGain(null);
      sfx("wrong");
    }
  }, [current, picked, streak, timeLeft, sfx]);

  const next = useCallback(() => {
    if (idx + 1 >= round.length) { finish(); return; }
    setIdx((i) => i + 1);
    setPicked(null);
    setGain(null);
    setTimeLeft(QUESTION_SECONDS);
  }, [idx, round.length, finish]);

  // المؤقت
  useEffect(() => {
    if (phase !== "playing" || answered) return;
    if (timeLeft <= 0) { answer(-1); return; }
    const t = setTimeout(() => {
      setTimeLeft((s) => s - 1);
      if (timeLeft <= 6) sfx("tick");
    }, 1000);
    return () => clearTimeout(t);
  }, [phase, answered, timeLeft, answer, sfx]);

  // انتقال تلقائي بعد الإجابة
  useEffect(() => {
    if (phase !== "playing" || !answered) return;
    const t = setTimeout(next, AUTO_NEXT_MS);
    return () => clearTimeout(t);
  }, [phase, answered, next]);

  // العودة للبداية تلقائياً لاستقبال الزائر التالي
  useEffect(() => {
    if (phase !== "result") return;
    const t = setTimeout(() => { setPhase("welcome"); setName(""); }, RESULT_IDLE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // اختصارات لوحة المفاتيح: 1-4 للإجابة، Enter للتالي
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase !== "playing") return;
      const n = Number(e.key);
      if (n >= 1 && n <= 4 && !answered) answer(n - 1);
      else if (e.key === "Enter" && answered) next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, answered, answer, next]);

  const clearBoard = () => {
    if (!window.confirm("هل تريد مسح لوحة المتصدرين بالكامل؟")) return;
    saveBoard([]);
    setBoard([]);
  };

  const myRank = useMemo(
    () => (lastAt ? board.findIndex((e) => e.at === lastAt) + 1 : 0),
    [board, lastAt],
  );

  return (
    <div dir="rtl" translate="no" className="quiz-root relative min-h-screen overflow-x-clip bg-[#0b0d14] text-white font-sans select-none">
      <style>{QUIZ_CSS}</style>
      <Backdrop />

      {/* الشريط العلوي */}
      <header className="relative z-10 flex items-center justify-between px-4 sm:px-8 py-4">
        <div className="flex items-center gap-3">
          <img src="/brand/app-icon.svg" alt="وصل" className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl" />
          <div>
            <p className="font-display font-extrabold text-lg sm:text-xl leading-none">تحدّي وصل التقني</p>
            <p className="text-xs sm:text-sm text-white/50 mt-1">اختبر معلوماتك وادخل لوحة الأبطال</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <IconBtn onClick={() => setMuted((m) => !m)} label={muted ? "تشغيل الصوت" : "كتم الصوت"}>
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </IconBtn>
          <IconBtn onClick={toggleFs} label="ملء الشاشة">
            {isFs ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </IconBtn>
        </div>
      </header>

      <main className="relative z-10 px-4 sm:px-8 pb-8">
        {phase === "welcome" && (
          <Welcome name={name} setName={setName} onStart={start} board={board} onClear={clearBoard} />
        )}

        {phase === "playing" && current && (
          <div key={current.id} className="max-w-5xl mx-auto quiz-pop">
            {/* التقدّم والنقاط */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-5">
              <Chip><span className="text-white/60">سؤال</span> <b className="text-lg">{idx + 1}</b><span className="text-white/40">/ {round.length}</span></Chip>
              <Chip><Trophy className="w-4 h-4 text-amber-400" /><b className="text-lg tabular-nums">{score}</b></Chip>
              {streak >= 2 && (
                <Chip className="border-orange-400/40 bg-orange-500/15 text-orange-200 quiz-pop">
                  <Flame className="w-4 h-4" /> سلسلة {streak}
                </Chip>
              )}
              <div className="flex-1" />
              <TimerRing left={timeLeft} />
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-8">
              <div className="h-full bg-gradient-to-l from-amber-300 to-amber-600 transition-all duration-500"
                style={{ width: `${((idx + (answered ? 1 : 0)) / round.length) * 100}%` }} />
            </div>

            {/* السؤال */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="px-3 py-1 rounded-full text-sm bg-white/10 text-white/80">{CATEGORY_LABELS[current.category]}</span>
              <span className={`px-3 py-1 rounded-full text-sm ${
                current.level === 1 ? "bg-emerald-500/15 text-emerald-300"
                : current.level === 2 ? "bg-sky-500/15 text-sky-300" : "bg-rose-500/15 text-rose-300"}`}>
                {LEVEL_LABELS[current.level]} · {current.level * 100} نقطة
              </span>
            </div>
            <h2 className="font-display font-extrabold text-2xl sm:text-4xl lg:text-5xl leading-snug mb-8 text-balance">
              {current.q}
            </h2>

            {/* الخيارات */}
            <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
              {current.shuffled.map((opt, i) => {
                const isCorrect = i === current.correctIndex;
                const isPicked = i === picked;
                let state = "border-white/10 bg-white/[0.04] hover:bg-white/[0.09] hover:border-amber-400/50 active:scale-[0.98]";
                if (answered) {
                  if (isCorrect) state = "border-emerald-400 bg-emerald-500/20 quiz-glow-ok";
                  else if (isPicked) state = "border-rose-400 bg-rose-500/20 quiz-shake";
                  else state = "border-white/5 bg-white/[0.02] opacity-40";
                }
                return (
                  <button key={i} disabled={answered} onClick={() => answer(i)}
                    className={`group flex items-center gap-4 text-right rounded-2xl border-2 p-4 sm:p-6 min-h-[84px] transition-all duration-200 ${state}`}>
                    <span className={`shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl grid place-items-center font-display font-black text-xl ${
                      answered && isCorrect ? "bg-emerald-400 text-emerald-950"
                      : answered && isPicked ? "bg-rose-400 text-rose-950"
                      : "bg-white/10 text-amber-300 group-hover:bg-amber-400 group-hover:text-black"}`}>
                      {answered && isCorrect ? <Check className="w-6 h-6" />
                        : answered && isPicked ? <X className="w-6 h-6" /> : LETTERS[i]}
                    </span>
                    <span className="text-lg sm:text-2xl font-semibold" dir="auto">{opt}</span>
                  </button>
                );
              })}
            </div>

            {/* النتيجة والشرح */}
            {answered && (
              <div className={`mt-6 rounded-2xl border p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 quiz-pop ${
                picked === current.correctIndex ? "border-emerald-400/40 bg-emerald-500/10" : "border-rose-400/40 bg-rose-500/10"}`}>
                <div className="flex-1">
                  <p className="font-display font-extrabold text-xl sm:text-2xl mb-1">
                    {picked === current.correctIndex ? "إجابة صحيحة!"
                      : picked === -1 ? "انتهى الوقت!" : "إجابة خاطئة"}
                    {gain !== null && <span className="text-amber-300 mr-3 tabular-nums">+{gain}</span>}
                  </p>
                  <p className="text-white/75 text-base sm:text-lg">
                    <Brain className="inline w-5 h-5 ml-1 text-amber-300 -mt-1" />
                    {current.note}
                  </p>
                </div>
                <button onClick={next}
                  className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 text-black font-bold text-lg px-6 py-4 hover:bg-amber-300 active:scale-95 transition relative overflow-hidden">
                  {idx + 1 >= round.length ? "عرض النتيجة" : "السؤال التالي"}
                  <ChevronLeft className="w-5 h-5" />
                  <span className="absolute bottom-0 right-0 h-1 bg-black/30 quiz-countdown" style={{ animationDuration: `${AUTO_NEXT_MS}ms` }} />
                </button>
              </div>
            )}
          </div>
        )}

        {phase === "result" && (
          <Result
            name={name.trim() || "زائر"} score={score} correct={correct} total={round.length}
            rank={myRank} board={board} lastAt={lastAt}
            onAgain={start} onHome={() => { setPhase("welcome"); setName(""); }}
          />
        )}
      </main>
    </div>
  );
}

/* ───────── الشاشات ───────── */
function Welcome({ name, setName, onStart, board, onClear }: {
  name: string; setName: (v: string) => void; onStart: () => void; board: ScoreEntry[]; onClear: () => void;
}) {
  return (
    <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.3fr_1fr] gap-8 lg:gap-12 items-center pt-4 lg:pt-12">
      <div className="quiz-pop">
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-amber-200 text-sm mb-6">
          <Zap className="w-4 h-4" /> 10 أسئلة · 20 ثانية لكل سؤال
        </span>
        <h1 className="font-display font-black text-5xl sm:text-6xl lg:text-7xl leading-[1.1] mb-5">
          هل أنت <span className="quiz-gradient-text">خبير تقنية</span>؟
        </h1>
        <p className="text-white/65 text-lg sm:text-xl mb-8 max-w-xl leading-relaxed">
          أسئلة في الذكاء الاصطناعي، الأمن السيبراني، البرمجة، الشبكات والجوالات.
          أجب بسرعة لتكسب نقاطاً أكثر، واجمع سلسلة إجابات صحيحة لمكافأة إضافية!
        </p>
        <form onSubmit={(e) => { e.preventDefault(); onStart(); }}
          className="flex flex-col sm:flex-row gap-3 max-w-xl">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24}
            placeholder="اكتب اسمك (اختياري)"
            className="flex-1 rounded-2xl bg-white/[0.06] border-2 border-white/10 focus:border-amber-400 outline-none px-5 py-4 text-lg placeholder:text-white/35 select-text" />
          <button type="submit"
            className="quiz-pulse whitespace-nowrap inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-l from-amber-300 to-amber-500 text-black font-display font-black text-xl px-8 py-4 hover:brightness-110 active:scale-95 transition">
            <Play className="w-6 h-6 fill-black" /> ابدأ التحدّي
          </button>
        </form>
        <div className="grid grid-cols-3 gap-3 mt-10 max-w-xl">
          {[
            { k: "سهل", v: "100", c: "text-emerald-300" },
            { k: "متوسط", v: "200", c: "text-sky-300" },
            { k: "صعب", v: "300", c: "text-rose-300" },
          ].map((x) => (
            <div key={x.k} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <p className={`font-display font-black text-2xl ${x.c}`}>{x.v}</p>
              <p className="text-white/50 text-sm">نقطة · {x.k}</p>
            </div>
          ))}
        </div>
      </div>

      <Leaderboard board={board} onClear={onClear} />
    </div>
  );
}

function Result({ name, score, correct, total, rank, board, lastAt, onAgain, onHome }: {
  name: string; score: number; correct: number; total: number; rank: number;
  board: ScoreEntry[]; lastAt: number | null; onAgain: () => void; onHome: () => void;
}) {
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const r = rankTitle(pct);
  return (
    <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.3fr_1fr] gap-8 lg:gap-12 items-start pt-4 lg:pt-8">
      {pct >= 50 && <Confetti />}
      <div className="text-center lg:text-right quiz-pop">
        <div className="inline-grid place-items-center w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-300 to-amber-600 mb-6 quiz-float">
          <Trophy className="w-12 h-12 text-black" />
        </div>
        <p className="text-white/60 text-xl mb-1">أحسنت يا {name}</p>
        <h2 className="font-display font-black text-4xl sm:text-6xl mb-3 quiz-gradient-text">{r.title}</h2>
        <p className="text-white/70 text-lg sm:text-xl mb-8">{r.sub}</p>

        <div className="grid grid-cols-3 gap-3 mb-8">
          <Stat label="النقاط" value={score.toLocaleString("en")} />
          <Stat label="إجابات صحيحة" value={`${correct}/${total}`} />
          <Stat label="ترتيبك" value={rank ? `#${rank}` : "-"} />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 lg:justify-start justify-center">
          <button onClick={onAgain}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-400 text-black font-display font-black text-xl px-8 py-4 hover:bg-amber-300 active:scale-95 transition">
            <RotateCcw className="w-5 h-5" /> العب مرة أخرى
          </button>
          <button onClick={onHome}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-white/15 font-bold text-lg px-8 py-4 hover:bg-white/10 transition">
            الزائر التالي
          </button>
        </div>
        <p className="text-white/35 text-sm mt-6">ستعود الشاشة للبداية تلقائياً بعد قليل</p>
      </div>

      <Leaderboard board={board} highlightAt={lastAt} />
    </div>
  );
}

function Leaderboard({ board, highlightAt, onClear }: {
  board: ScoreEntry[]; highlightAt?: number | null; onClear?: () => void;
}) {
  const top = board.slice(0, 8);
  const medal = ["text-amber-300", "text-slate-300", "text-orange-400"];
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur p-5 sm:p-6 quiz-pop">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-extrabold text-xl flex items-center gap-2">
          <Medal className="w-6 h-6 text-amber-300" /> لوحة الأبطال
        </h3>
        {onClear && board.length > 0 && (
          <button onClick={onClear} aria-label="مسح النتائج"
            className="text-white/25 hover:text-rose-300 p-1.5 rounded-lg transition">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      {top.length === 0 ? (
        <p className="text-white/45 text-center py-10">كن أول من يسجّل اسمه هنا!</p>
      ) : (
        <ol className="space-y-2">
          {top.map((e, i) => (
            <li key={e.at}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                e.at === highlightAt ? "bg-amber-400/20 border border-amber-400/50" : "bg-white/[0.03]"}`}>
              <span className={`w-8 text-center font-display font-black text-lg ${medal[i] ?? "text-white/40"}`}>{i + 1}</span>
              <span className="flex-1 truncate font-semibold" dir="auto">{e.name}</span>
              <span className="text-white/40 text-sm tabular-nums">{e.correct}/{e.total}</span>
              <span className="font-display font-black tabular-nums text-amber-200 w-16 text-left">{e.score}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ───────── مكوّنات صغيرة ───────── */
function TimerRing({ left }: { left: number }) {
  const r = 26, c = 2 * Math.PI * r;
  const frac = left / QUESTION_SECONDS;
  const color = left <= 5 ? "#fb7185" : left <= 10 ? "#fbbf24" : "#34d399";
  return (
    <div className={`relative w-16 h-16 ${left <= 5 ? "quiz-shake-soft" : ""}`} aria-label={`متبقي ${left} ثانية`}>
      <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
        <circle cx="32" cy="32" r={r} stroke="rgba(255,255,255,.1)" strokeWidth="6" fill="none" />
        <circle cx="32" cy="32" r={r} stroke={color} strokeWidth="6" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: "stroke-dashoffset 1s linear, stroke .3s" }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display font-black text-xl tabular-nums">
        {left > 0 ? left : <Timer className="w-5 h-5" />}
      </span>
    </div>
  );
}

function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 ${className}`}>
      {children}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <p className="font-display font-black text-2xl sm:text-4xl text-amber-300 tabular-nums">{value}</p>
      <p className="text-white/55 text-sm sm:text-base mt-1">{label}</p>
    </div>
  );
}

function IconBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-label={label} title={label}
      className="w-11 h-11 grid place-items-center rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/10 transition">
      {children}
    </button>
  );
}

function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute -top-40 -right-40 w-[36rem] h-[36rem] rounded-full bg-amber-500/20 blur-[120px] quiz-drift" />
      <div className="absolute -bottom-40 -left-40 w-[32rem] h-[32rem] rounded-full bg-indigo-500/20 blur-[120px] quiz-drift-rev" />
      <div className="absolute inset-0 quiz-grid" />
    </div>
  );
}

function Confetti() {
  const pieces = useRef(
    Array.from({ length: 70 }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 1.5,
      dur: 2.5 + Math.random() * 2,
      color: ["#fbbf24", "#f59e0b", "#34d399", "#60a5fa", "#f472b6", "#ffffff"][Math.floor(Math.random() * 6)],
      size: 6 + Math.random() * 8,
    })),
  ).current;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
      {pieces.map((p, i) => (
        <span key={i} className="quiz-confetti absolute top-[-20px] rounded-sm"
          style={{ left: `${p.left}%`, width: p.size, height: p.size * 0.5, background: p.color,
            animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }} />
      ))}
    </div>
  );
}

const QUIZ_CSS = `
.quiz-gradient-text{background:linear-gradient(90deg,#fde68a,#f59e0b,#fde68a);background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:quiz-shine 4s linear infinite}
.quiz-grid{background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:48px 48px;mask-image:radial-gradient(ellipse at center,#000 30%,transparent 75%)}
.quiz-pop{animation:quiz-pop .45s cubic-bezier(.2,.9,.3,1.2) both}
.quiz-shake{animation:quiz-shake .45s}
.quiz-shake-soft{animation:quiz-shake .6s infinite}
.quiz-glow-ok{box-shadow:0 0 0 4px rgba(52,211,153,.15),0 0 40px rgba(52,211,153,.25)}
.quiz-pulse{animation:quiz-pulse 2s infinite}
.quiz-float{animation:quiz-float 3s ease-in-out infinite}
.quiz-drift{animation:quiz-drift 14s ease-in-out infinite}
.quiz-drift-rev{animation:quiz-drift 18s ease-in-out infinite reverse}
.quiz-countdown{animation-name:quiz-countdown;animation-timing-function:linear;animation-fill-mode:forwards}
.quiz-confetti{animation-name:quiz-fall;animation-timing-function:linear;animation-fill-mode:forwards}
@keyframes quiz-shine{to{background-position:200% center}}
@keyframes quiz-pop{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
@keyframes quiz-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}
@keyframes quiz-pulse{0%,100%{box-shadow:0 0 0 0 rgba(251,191,36,.5)}50%{box-shadow:0 0 0 14px rgba(251,191,36,0)}}
@keyframes quiz-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes quiz-drift{0%,100%{transform:translate(0,0)}50%{transform:translate(-60px,40px)}}
@keyframes quiz-countdown{from{width:0}to{width:100%}}
@keyframes quiz-fall{to{transform:translateY(110vh) rotate(720deg)}}
@media (prefers-reduced-motion:reduce){.quiz-root *{animation:none!important}}
`;
