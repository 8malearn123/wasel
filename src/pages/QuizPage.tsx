import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Trophy, Timer, Zap, Check, X, RotateCcw, Maximize, Minimize, Volume2, VolumeX,
  Flame, Medal, Trash2, ChevronLeft, Brain, LogOut, Scissors, Clock, SkipForward,
  Rocket, Bot, Atom, Gamepad2, Crown, Ghost, Cat, Satellite, Lightbulb, Users, Target,
  Cpu, Wifi, Smartphone, Shield, Code2, Lock, Play, Repeat,
} from "lucide-react";
import { CATEGORY_LABELS, LEVEL_LABELS, FUN_FACTS } from "./quiz/questions";
import {
  QUESTION_SECONDS, BLITZ_SECONDS, AUTO_NEXT_MS, BLITZ_NEXT_MS, RESULT_IDLE_MS, PAUSE_IDLE_MS,
  MAX_IDLE_TIMEOUTS, MODE_LABELS, SFX, CHEERS, OOPS, buildClassicRound, buildBlitzRound,
  loadBoard, saveBoard, rankBoard, loadPlaysToday, bumpPlaysToday, shuffle, pick,
  classicTitle, blitzTitle, type Mode, type RoundQuestion, type ScoreEntry, type SfxKey,
} from "./quiz/engine";

const LETTERS = ["أ", "ب", "ج", "د"];
const BRAND = "#600B0D";

const AVATARS = [
  { Icon: Rocket, bg: "#600B0D", label: "صاروخ" },
  { Icon: Bot, bg: "#0F766E", label: "روبوت" },
  { Icon: Atom, bg: "#1D4ED8", label: "ذرّة" },
  { Icon: Gamepad2, bg: "#7C3AED", label: "لاعب" },
  { Icon: Crown, bg: "#B45309", label: "ملك" },
  { Icon: Ghost, bg: "#475569", label: "شبح" },
  { Icon: Cat, bg: "#BE185D", label: "قطّة" },
  { Icon: Satellite, bg: "#15803D", label: "قمر صناعي" },
];

type Phase = "welcome" | "countdown" | "playing" | "result";
type Reaction = { text: string; good: boolean; key: number };
type BadgeId = "perfect" | "lightning" | "fire" | "solo" | "record" | "machine" | "sharp";
const BADGES: Record<BadgeId, { title: string; desc: string; Icon: typeof Trophy }> = {
  perfect: { title: "العلامة الكاملة", desc: "كل الإجابات صحيحة", Icon: Crown },
  lightning: { title: "سريع البرق", desc: "إجابة صحيحة خلال 3 ثوانٍ", Icon: Zap },
  fire: { title: "سلسلة نارية", desc: "5 إجابات صحيحة متتالية", Icon: Flame },
  solo: { title: "بلا مساعدة", desc: "7 صحيحة دون وسائل مساعدة", Icon: Shield },
  machine: { title: "آلة الإجابات", desc: "10 إجابات صحيحة أو أكثر", Icon: Cpu },
  sharp: { title: "قنّاص", desc: "دقة 90% في 8 أسئلة أو أكثر", Icon: Target },
  record: { title: "صاحب الرقم القياسي", desc: "المركز الأول في اللوحة", Icon: Trophy },
};
const MODE_BADGES: Record<Mode, BadgeId[]> = {
  classic: ["perfect", "lightning", "fire", "solo", "record"],
  blitz: ["machine", "sharp", "fire", "record"],
};

interface RoundResult {
  mode: Mode; name: string; avatar: number; score: number; correct: number; total: number;
  rank: number; at: number; newRecord: boolean; toTop: number; badges: BadgeId[]; maxStreak: number;
}

/* ───────── الصفحة ───────── */
export default function QuizPage() {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [mode, setMode] = useState<Mode>("classic");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(0);
  const [round, setRound] = useState<RoundQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null); // -1 = انتهى الوقت
  const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS);
  const [extra, setExtra] = useState(0);
  const [blitzLeft, setBlitzLeft] = useState(BLITZ_SECONDS);
  const [count, setCount] = useState(3);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [lightning, setLightning] = useState(false);
  const [gain, setGain] = useState<number | null>(null);
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [hidden, setHidden] = useState<number[]>([]);
  const [used, setUsed] = useState({ fifty: false, time: false, skip: false });
  const [idleTimeouts, setIdleTimeouts] = useState(0);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [board, setBoard] = useState<ScoreEntry[]>(loadBoard);
  const [plays, setPlays] = useState(loadPlaysToday);
  const [muted, setMuted] = useState(false);
  const [isFs, setIsFs] = useState(false);

  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const play = useCallback((k: SfxKey) => { if (!mutedRef.current) SFX[k](); }, []);

  const current = round[idx];
  const answered = picked !== null;
  const inGame = phase === "countdown" || phase === "playing";

  useEffect(() => {
    document.title = "تحدّي غراس التقني";
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFs = () => {
    try {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else document.documentElement.requestFullscreen?.().catch(() => {});
    } catch { /* غير مدعوم */ }
  };

  /* ── التحكم في الجولة ── */
  const start = (m: Mode) => {
    setMode(m);
    setRound(m === "classic" ? buildClassicRound() : buildBlitzRound());
    setIdx(0); setPicked(null); setTimeLeft(QUESTION_SECONDS); setExtra(0); setBlitzLeft(BLITZ_SECONDS);
    setScore(0); setCorrect(0); setAnsweredCount(0); setStreak(0); setMaxStreak(0); setLightning(false);
    setGain(null); setReaction(null); setHidden([]); setUsed({ fifty: false, time: false, skip: false });
    setIdleTimeouts(0); setPaused(false); setResult(null);
    setCount(3); setPhase("countdown");
    setPlays(bumpPlaysToday());
    play("count");
  };

  const quit = useCallback(() => {
    setPaused(false);
    setPhase("welcome");
  }, []);

  const finish = useCallback(() => {
    const total = mode === "classic" ? round.length : answeredCount;
    if (mode === "blitz" && answeredCount === 0) { quit(); return; }
    const all = loadBoard();
    const before = rankBoard(all, mode);
    const prevBest = before[0]?.score ?? 0;
    const entry: ScoreEntry = {
      name: name.trim() || "زائر", score, correct, total, at: Date.now(), mode, avatar,
    };
    const nextBoard = [...all, entry].sort((a, b) => b.score - a.score || a.at - b.at).slice(0, 300);
    saveBoard(nextBoard);
    setBoard(nextBoard);
    const ranked = rankBoard(nextBoard, mode);
    const rank = ranked.findIndex((e) => e.at === entry.at) + 1;
    const newRecord = before.length > 0 && score > prevBest;

    const badges: BadgeId[] = [];
    if (mode === "classic") {
      if (correct === total) badges.push("perfect");
      if (lightning) badges.push("lightning");
      if (maxStreak >= 5) badges.push("fire");
      if (!used.fifty && !used.time && !used.skip && correct >= 7) badges.push("solo");
    } else {
      if (correct >= 10) badges.push("machine");
      if (total >= 8 && correct / total >= 0.9) badges.push("sharp");
      if (maxStreak >= 5) badges.push("fire");
    }
    if (rank === 1) badges.push("record");

    setResult({
      mode, name: entry.name, avatar, score, correct, total, rank, at: entry.at, newRecord,
      toTop: rank > 1 ? ranked[0].score - score + 1 : 0, badges, maxStreak,
    });
    setPhase("result");
    play(newRecord ? "record" : "win");
  }, [mode, round.length, answeredCount, name, score, correct, avatar, lightning, maxStreak, used, quit, play]);

  const answer = useCallback((choice: number) => {
    if (!current || picked !== null || paused) return;
    setPicked(choice);
    setAnsweredCount((c) => c + 1);
    const key = Date.now();
    if (choice === current.correctIndex) {
      const newStreak = streak + 1;
      const taken = QUESTION_SECONDS + extra - timeLeft;
      const fast = mode === "classic" && taken <= 3;
      const pts = mode === "classic"
        ? current.level * 100 + timeLeft * 5 + (newStreak >= 3 ? 50 : 0)
        : current.level * 50 + Math.min(newStreak - 1, 5) * 10;
      setScore((s) => s + pts);
      setCorrect((c) => c + 1);
      setStreak(newStreak);
      setMaxStreak((m) => Math.max(m, newStreak));
      if (fast) setLightning(true);
      setGain(pts);
      setReaction({
        text: fast ? "سريع البرق!" : newStreak >= 3 ? `سلسلة ${newStreak} متتالية!` : pick(CHEERS),
        good: true, key,
      });
      play(newStreak >= 3 ? "streak" : "correct");
    } else {
      setStreak(0);
      setGain(null);
      setReaction({ text: choice === -1 ? "انتهى الوقت!" : pick(OOPS), good: false, key });
      play("wrong");
    }
    if (choice !== -1) setIdleTimeouts(0);
  }, [current, picked, paused, streak, extra, timeLeft, mode, play]);

  const next = useCallback(() => {
    if (idx + 1 >= round.length) { finish(); return; }
    setIdx((i) => i + 1);
    setPicked(null); setGain(null); setHidden([]); setExtra(0); setTimeLeft(QUESTION_SECONDS);
  }, [idx, round.length, finish]);

  // مراجع لأحدث الدوال حتى لا تُعاد المؤقتات مع كل تغيير في النقاط
  const latest = useRef({ answer, next, finish, quit });
  latest.current = { answer, next, finish, quit };

  /* ── وسائل المساعدة ── */
  const takeFifty = () => {
    if (!current || answered || used.fifty) return;
    const wrong = [0, 1, 2, 3].filter((i) => i !== current.correctIndex);
    setHidden(shuffle(wrong).slice(0, 2));
    setUsed((u) => ({ ...u, fifty: true }));
    setIdleTimeouts(0);
    play("lifeline");
  };
  const takeTime = () => {
    if (answered || used.time) return;
    setTimeLeft((t) => t + 10);
    setExtra((e) => e + 10);
    setUsed((u) => ({ ...u, time: true }));
    setIdleTimeouts(0);
    play("lifeline");
  };
  const takeSkip = () => {
    if (answered || used.skip) return;
    setUsed((u) => ({ ...u, skip: true }));
    setIdleTimeouts(0);
    play("lifeline");
    next();
  };

  /* ── المؤقتات ── */
  // العدّ التنازلي قبل البداية
  useEffect(() => {
    if (phase !== "countdown" || paused) return;
    const t = setTimeout(() => {
      if (count > 1) { setCount(count - 1); play("count"); }
      else if (count === 1) { setCount(0); play("go"); }
      else setPhase("playing");
    }, count === 0 ? 650 : 850);
    return () => clearTimeout(t);
  }, [phase, count, paused, play]);

  // مؤقت السؤال (الكلاسيكي)
  useEffect(() => {
    if (phase !== "playing" || mode !== "classic" || answered || paused) return;
    if (timeLeft <= 0) {
      const n = idleTimeouts + 1;
      if (n >= MAX_IDLE_TIMEOUTS) { latest.current.quit(); return; }
      setIdleTimeouts(n);
      latest.current.answer(-1);
      return;
    }
    const t = setTimeout(() => {
      setTimeLeft((s) => s - 1);
      if (timeLeft <= 6) play("tick");
    }, 1000);
    return () => clearTimeout(t);
  }, [phase, mode, answered, paused, timeLeft, idleTimeouts, play]);

  // مؤقت جولة البرق
  useEffect(() => {
    if (phase !== "playing" || mode !== "blitz" || paused) return;
    if (blitzLeft <= 0) { latest.current.finish(); return; }
    const t = setTimeout(() => {
      setBlitzLeft((s) => s - 1);
      if (blitzLeft <= 6) play("tick");
    }, 1000);
    return () => clearTimeout(t);
  }, [phase, mode, paused, blitzLeft, play]);

  // الانتقال التلقائي بعد الإجابة
  useEffect(() => {
    if (phase !== "playing" || !answered || paused) return;
    const t = setTimeout(() => latest.current.next(), mode === "blitz" ? BLITZ_NEXT_MS : AUTO_NEXT_MS);
    return () => clearTimeout(t);
  }, [phase, answered, paused, mode, idx]);

  // نافذة الخروج: إذا تُركت مفتوحة نخرج تلقائياً حتى لا تتجمّد الشاشة
  useEffect(() => {
    if (!paused) return;
    const t = setTimeout(() => latest.current.quit(), PAUSE_IDLE_MS);
    return () => clearTimeout(t);
  }, [paused]);

  // العودة للبداية تلقائياً لاستقبال الزائر التالي
  useEffect(() => {
    if (phase !== "result") return;
    const t = setTimeout(() => { setPhase("welcome"); setName(""); }, RESULT_IDLE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // لوحة المفاتيح: 1-4 للإجابة، Enter للتالي، Esc للخروج
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && inGame) { setPaused((p) => !p); return; }
      if (phase !== "playing" || paused) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 4 && !answered && !hidden.includes(n - 1)) latest.current.answer(n - 1);
      else if (e.key === "Enter" && answered && mode === "classic") latest.current.next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, inGame, paused, answered, hidden, mode]);

  const clearBoard = () => { saveBoard([]); setBoard([]); };

  const timerMax = mode === "classic" ? QUESTION_SECONDS + extra : BLITZ_SECONDS;
  const timerValue = mode === "classic" ? timeLeft : blitzLeft;

  return (
    <div dir="rtl" translate="no" className="quiz-root relative min-h-screen overflow-x-clip bg-[#FBF6EF] text-[#2B0A0B] font-sans select-none">
      <style>{QUIZ_CSS}</style>
      <Backdrop />

      {/* وميض الشاشة عند الإجابة */}
      {reaction && phase === "playing" && (
        <div key={`f${reaction.key}`} aria-hidden
          className={`pointer-events-none fixed inset-0 z-20 quiz-flash ${reaction.good ? "quiz-flash-ok" : "quiz-flash-bad"}`} />
      )}
      {/* عبارة تفاعلية */}
      {reaction && phase === "playing" && (
        <div key={`r${reaction.key}`} aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-[28%] z-30 flex justify-center px-4">
          <span className={`quiz-reaction font-display font-black text-3xl sm:text-5xl px-8 py-4 rounded-3xl shadow-2xl border-4 ${
            reaction.good ? "bg-white text-emerald-700 border-emerald-400" : "bg-white text-rose-700 border-rose-300"}`}>
            {reaction.text}
          </span>
        </div>
      )}

      {/* الشريط العلوي */}
      <header className="relative z-10 flex items-center justify-between gap-3 px-4 sm:px-8 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <img src="/ghirass/logo.png" alt="فريق غراس التطوعي" className={`w-auto transition-all ${phase === "welcome" ? "h-16 sm:h-24" : "h-12 sm:h-16"}`} />
          <div className="hidden sm:block border-r border-[#600B0D]/15 pr-3">
            <p className="font-display font-extrabold text-lg sm:text-xl leading-none text-[#600B0D]">تحدّي غراس التقني</p>
            <p className="text-xs sm:text-sm text-[#2B0A0B]/55 mt-1">
              {inGame ? MODE_LABELS[mode] : "اختبر معلوماتك وادخل لوحة الأبطال"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {inGame && (
            <button onClick={() => setPaused(true)}
              className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-rose-300 bg-white text-rose-700 font-bold hover:bg-rose-50 transition">
              <LogOut className="w-5 h-5" /> خروج
            </button>
          )}
          <IconBtn onClick={() => setMuted((m) => !m)} label={muted ? "تشغيل الصوت" : "كتم الصوت"}>
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </IconBtn>
          <IconBtn onClick={toggleFs} label="ملء الشاشة">
            {isFs ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </IconBtn>
        </div>
      </header>

      <main className="relative z-10 px-4 sm:px-8 pb-10">
        {phase === "welcome" && (
          <Welcome name={name} setName={setName} avatar={avatar} setAvatar={(i) => { setAvatar(i); play("pick"); }}
            onStart={start} board={board} onClear={clearBoard} plays={plays} />
        )}

        {phase === "countdown" && (
          <div className="min-h-[60vh] grid place-items-center text-center">
            <div>
              <p className="text-[#2B0A0B]/60 text-xl sm:text-2xl mb-6">
                استعد يا <b className="text-[#600B0D]">{name.trim() || "بطل"}</b> · {MODE_LABELS[mode]}
              </p>
              <div key={count} className="quiz-count font-display font-black text-[9rem] sm:text-[13rem] leading-none text-[#600B0D]">
                {count > 0 ? count : "انطلق!"}
              </div>
              {mode === "blitz" && (
                <p className="mt-6 text-lg text-[#2B0A0B]/60">60 ثانية فقط. أجب على أكبر عدد ممكن من الأسئلة!</p>
              )}
            </div>
          </div>
        )}

        {phase === "playing" && current && (
          <div key={current.id} className="max-w-5xl mx-auto quiz-pop">
            {/* التقدّم والنقاط */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-5">
              {mode === "classic" ? (
                <Chip><span className="text-[#2B0A0B]/60">سؤال</span> <b className="text-lg">{idx + 1}</b><span className="text-[#2B0A0B]/40">/ {round.length}</span></Chip>
              ) : (
                <Chip><Check className="w-4 h-4 text-emerald-600" /><b className="text-lg tabular-nums">{correct}</b><span className="text-[#2B0A0B]/50">صحيحة</span></Chip>
              )}
              <Chip className="relative">
                <Trophy className="w-4 h-4 text-[#600B0D]" /><b className="text-lg tabular-nums">{score.toLocaleString("en")}</b>
                {gain !== null && (
                  <span key={`g${idx}`} className="quiz-rise absolute -top-2 left-1/2 font-display font-black text-emerald-600 text-xl">+{gain}</span>
                )}
              </Chip>
              {streak >= 2 && (
                <Chip className="border-orange-500/30 bg-orange-50 text-orange-700 quiz-pop">
                  <Flame className="w-4 h-4 quiz-flicker" /> سلسلة ×{streak}
                </Chip>
              )}
              <div className="flex-1" />
              <TimerRing left={timerValue} max={timerMax} />
            </div>
            <div className="h-2 rounded-full bg-[#600B0D]/10 overflow-hidden mb-6">
              <div className="h-full bg-gradient-to-l from-[#A8383B] to-[#600B0D] transition-all duration-500"
                style={{ width: mode === "classic"
                  ? `${((idx + (answered ? 1 : 0)) / round.length) * 100}%`
                  : `${(blitzLeft / BLITZ_SECONDS) * 100}%` }} />
            </div>

            {/* السؤال */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="px-3 py-1 rounded-full text-sm bg-[#600B0D]/10 text-[#2B0A0B]/80">{CATEGORY_LABELS[current.category]}</span>
              <span className={`px-3 py-1 rounded-full text-sm ${
                current.level === 1 ? "bg-emerald-500/15 text-emerald-700"
                : current.level === 2 ? "bg-sky-500/15 text-sky-700" : "bg-rose-500/15 text-rose-700"}`}>
                {LEVEL_LABELS[current.level]} · {mode === "classic" ? current.level * 100 : current.level * 50} نقطة
              </span>
            </div>
            <h2 className="font-display font-extrabold text-2xl sm:text-4xl lg:text-5xl leading-snug mb-7 text-balance">
              {current.q}
            </h2>

            {/* الخيارات */}
            <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
              {current.shuffled.map((opt, i) => {
                const isCorrect = i === current.correctIndex;
                const isPicked = i === picked;
                const isHidden = hidden.includes(i);
                let state = "border-[#600B0D]/10 bg-white hover:bg-[#600B0D]/5 hover:border-[#600B0D]/40 hover:-translate-y-0.5 active:scale-[0.98] shadow-sm";
                if (isHidden && !answered) state = "border-dashed border-[#600B0D]/15 bg-transparent opacity-30 quiz-vanish";
                if (answered) {
                  if (isCorrect) state = "border-emerald-500 bg-emerald-50 quiz-glow-ok";
                  else if (isPicked) state = "border-rose-500 bg-rose-50 quiz-shake";
                  else state = "border-[#600B0D]/5 bg-white/50 opacity-40";
                }
                return (
                  <button key={i} disabled={answered || isHidden} onClick={() => answer(i)}
                    className={`group flex items-center gap-4 text-right rounded-2xl border-2 p-4 sm:p-6 min-h-[84px] transition-all duration-200 quiz-option ${state}`}
                    style={{ animationDelay: `${i * 60}ms` }}>
                    <span className={`shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl grid place-items-center font-display font-black text-xl ${
                      answered && isCorrect ? "bg-emerald-500 text-white"
                      : answered && isPicked ? "bg-rose-500 text-white"
                      : "bg-[#600B0D]/10 text-[#600B0D] group-hover:bg-[#600B0D] group-hover:text-white"}`}>
                      {answered && isCorrect ? <Check className="w-6 h-6" />
                        : answered && isPicked ? <X className="w-6 h-6" /> : LETTERS[i]}
                    </span>
                    <span className="text-lg sm:text-2xl font-semibold" dir="auto">{opt}</span>
                  </button>
                );
              })}
            </div>

            {/* وسائل المساعدة */}
            {mode === "classic" && !answered && (
              <div className="mt-6 flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="text-[#2B0A0B]/50 text-sm ml-1">وسائل المساعدة (مرة واحدة لكل منها):</span>
                <Lifeline Icon={Scissors} label="حذف إجابتين" used={used.fifty} onClick={takeFifty} />
                <Lifeline Icon={Clock} label="+10 ثوانٍ" used={used.time} onClick={takeTime} />
                <Lifeline Icon={SkipForward} label="تخطَّ السؤال" used={used.skip} onClick={takeSkip} />
              </div>
            )}

            {/* النتيجة والشرح */}
            {answered && mode === "classic" && (
              <div className={`mt-6 rounded-2xl border p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 quiz-pop ${
                picked === current.correctIndex ? "border-emerald-500/30 bg-emerald-50" : "border-rose-500/30 bg-rose-50"}`}>
                <div className="flex-1">
                  <p className="font-display font-extrabold text-xl sm:text-2xl mb-1">
                    {picked === current.correctIndex ? "إجابة صحيحة!"
                      : picked === -1 ? "انتهى الوقت!" : "إجابة خاطئة"}
                    {gain !== null && <span className="text-[#600B0D] mr-3 tabular-nums">+{gain}</span>}
                  </p>
                  <p className="text-[#2B0A0B]/75 text-base sm:text-lg">
                    <Brain className="inline w-5 h-5 ml-1 text-[#600B0D] -mt-1" />
                    {current.note}
                  </p>
                </div>
                <button onClick={next}
                  className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-[#600B0D] text-white font-bold text-lg px-6 py-4 hover:bg-[#7A1518] active:scale-95 transition relative overflow-hidden">
                  {idx + 1 >= round.length ? "عرض النتيجة" : "السؤال التالي"}
                  <ChevronLeft className="w-5 h-5" />
                  {!paused && (
                    <span className="absolute bottom-0 right-0 h-1 bg-white/40 quiz-countdown" style={{ animationDuration: `${AUTO_NEXT_MS}ms` }} />
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {phase === "result" && result && (
          <Result r={result} board={board}
            onAgain={() => start(result.mode)}
            onOther={() => start(result.mode === "classic" ? "blitz" : "classic")}
            onHome={() => { setPhase("welcome"); setName(""); }} />
        )}
      </main>

      {/* نافذة تأكيد الخروج */}
      {paused && inGame && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#2B0A0B]/40 backdrop-blur-sm p-4 quiz-fade" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 text-center shadow-2xl quiz-pop">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 grid place-items-center mb-4">
              <LogOut className="w-8 h-8" />
            </div>
            <h3 className="font-display font-black text-2xl mb-2">تريد الخروج من التحدي؟</h3>
            <p className="text-[#2B0A0B]/60 mb-6">اللعبة متوقفة الآن. إذا خرجت لن تُحفظ نتيجة هذه الجولة.</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setPaused(false)} autoFocus
                className="rounded-xl bg-[#600B0D] text-white font-bold text-lg py-3.5 hover:bg-[#7A1518] transition">
                أكمل اللعب
              </button>
              <button onClick={quit}
                className="rounded-xl border-2 border-rose-300 text-rose-700 font-bold text-lg py-3.5 hover:bg-rose-50 transition">
                نعم، اخرج
              </button>
            </div>
            <div className="mt-5 h-1 rounded-full bg-[#600B0D]/10 overflow-hidden">
              <div className="h-full bg-[#600B0D]/30 quiz-countdown" style={{ animationDuration: `${PAUSE_IDLE_MS}ms` }} />
            </div>
            <p className="text-xs text-[#2B0A0B]/40 mt-2">سيتم الخروج تلقائياً إذا لم تختر</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── شاشة البداية ───────── */
function Welcome({ name, setName, avatar, setAvatar, onStart, board, onClear, plays }: {
  name: string; setName: (v: string) => void; avatar: number; setAvatar: (i: number) => void;
  onStart: (m: Mode) => void; board: ScoreEntry[]; onClear: () => void; plays: number;
}) {
  const [tab, setTab] = useState<Mode>("classic");
  const bestClassic = useMemo(() => rankBoard(board, "classic")[0], [board]);
  const bestBlitz = useMemo(() => rankBoard(board, "blitz")[0], [board]);

  return (
    <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.25fr_1fr] gap-8 lg:gap-12 items-start pt-2 lg:pt-6">
      <div className="quiz-pop min-w-0">
        <div className="flex flex-wrap gap-2 mb-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#600B0D]/20 bg-[#600B0D]/5 px-4 py-1.5 text-[#600B0D] text-sm">
            <Users className="w-4 h-4" /> لعب اليوم: <b className="tabular-nums">{plays}</b> زائر
          </span>
          {bestClassic && (
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-50 px-4 py-1.5 text-amber-800 text-sm quiz-shimmer">
              <Crown className="w-4 h-4" /> الرقم القياسي <b className="tabular-nums">{bestClassic.score.toLocaleString("en")}</b> لـ <span dir="auto">{bestClassic.name}</span>، هل تكسره؟
            </span>
          )}
        </div>
        <h1 className="font-display font-black text-5xl sm:text-6xl leading-[1.1] mb-4">
          هل أنت <span className="quiz-gradient-text">خبير تقنية</span>؟
        </h1>
        <p className="text-[#2B0A0B]/65 text-lg sm:text-xl mb-7 max-w-xl leading-relaxed">
          أسئلة في الذكاء الاصطناعي، الأمن السيبراني، البرمجة، الشبكات والجوالات. اختر شخصيتك وابدأ!
        </p>

        {/* الاسم والشخصية */}
        <div className="rounded-3xl border border-[#600B0D]/10 bg-white/80 p-4 sm:p-5 mb-5 max-w-xl">
          <label htmlFor="quiz-name" className="block text-sm font-bold text-[#2B0A0B]/70 mb-2">اسمك</label>
          <input id="quiz-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={24}
            onKeyDown={(e) => { if (e.key === "Enter") onStart("classic"); }}
            placeholder="اكتب اسمك (اختياري)"
            className="w-full rounded-2xl bg-[#FBF6EF] border-2 border-[#600B0D]/10 focus:border-[#600B0D] outline-none px-5 py-3.5 text-lg placeholder:text-[#2B0A0B]/35 select-text mb-4" />
          <p className="text-sm font-bold text-[#2B0A0B]/70 mb-2">اختر شخصيتك</p>
          <div className="flex flex-wrap gap-2">
            {AVATARS.map((a, i) => (
              <button key={i} onClick={() => setAvatar(i)} aria-label={a.label} aria-pressed={avatar === i}
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl grid place-items-center text-white transition ${
                  avatar === i ? "ring-4 ring-offset-2 ring-[#600B0D]/40 scale-110 quiz-bounce" : "opacity-60 hover:opacity-100 hover:scale-105"}`}
                style={{ background: a.bg }}>
                <a.Icon className="w-6 h-6 sm:w-7 sm:h-7" />
              </button>
            ))}
          </div>
        </div>

        {/* اختيار نمط اللعب */}
        <div className="grid sm:grid-cols-2 gap-3 max-w-xl">
          <button onClick={() => onStart("classic")}
            className="quiz-pulse group text-right rounded-3xl bg-[#600B0D] text-white p-5 hover:bg-[#7A1518] active:scale-[0.98] transition">
            <span className="flex items-center justify-between gap-3 mb-2">
              <span className="font-display font-black text-xl sm:text-2xl whitespace-nowrap">التحدي الكلاسيكي</span>
              <Play className="w-7 h-7 fill-white group-hover:translate-x-[-4px] transition" />
            </span>
            <span className="block text-white/75 text-sm leading-relaxed">10 أسئلة · 20 ثانية لكل سؤال · 3 وسائل مساعدة</span>
          </button>
          <button onClick={() => onStart("blitz")}
            className="group text-right rounded-3xl border-2 border-[#600B0D] bg-white text-[#600B0D] p-5 hover:bg-[#600B0D]/5 active:scale-[0.98] transition">
            <span className="flex items-center justify-between gap-3 mb-2">
              <span className="font-display font-black text-xl sm:text-2xl whitespace-nowrap">جولة البرق</span>
              <Zap className="w-7 h-7 fill-[#600B0D] quiz-flicker" />
            </span>
            <span className="block text-[#2B0A0B]/65 text-sm leading-relaxed">
              60 ثانية · أجب على أكبر عدد ممكن
              {bestBlitz && <> · الرقم <b className="tabular-nums">{bestBlitz.score}</b></>}
            </span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-5 min-w-0">
        <Leaderboard board={board} mode={tab} onTab={setTab} onClear={onClear} />
        <FactCard />
      </div>
    </div>
  );
}

/* ───────── شاشة النتيجة ───────── */
function Result({ r, board, onAgain, onOther, onHome }: {
  r: RoundResult; board: ScoreEntry[]; onAgain: () => void; onOther: () => void; onHome: () => void;
}) {
  const t = r.mode === "classic" ? classicTitle(r.total ? (r.correct / r.total) * 100 : 0) : blitzTitle(r.correct);
  const A = AVATARS[r.avatar] ?? AVATARS[0];
  const celebrate = r.newRecord || r.rank <= 3 || r.correct / Math.max(r.total, 1) >= 0.5;
  return (
    <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.25fr_1fr] gap-8 lg:gap-12 items-start pt-2 lg:pt-6">
      {celebrate && <Confetti count={r.newRecord ? 140 : 70} />}
      <div className="quiz-pop min-w-0">
        {r.newRecord && (
          <div className="mb-6 rounded-3xl bg-gradient-to-l from-amber-400 via-amber-300 to-amber-500 text-amber-950 p-4 sm:p-5 flex items-center gap-4 quiz-record">
            <Crown className="w-10 h-10 shrink-0" />
            <div>
              <p className="font-display font-black text-2xl sm:text-3xl leading-tight">رقم قياسي جديد!</p>
              <p className="font-semibold">كسرت أعلى نتيجة في {MODE_LABELS[r.mode]}</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-4 mb-4">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl grid place-items-center text-white quiz-float shrink-0" style={{ background: A.bg }}>
            <A.Icon className="w-10 h-10 sm:w-12 sm:h-12" />
          </div>
          <div className="min-w-0">
            <p className="text-[#2B0A0B]/60 text-lg sm:text-xl">أحسنت يا <span dir="auto">{r.name}</span> · {MODE_LABELS[r.mode]}</p>
            <h2 className="font-display font-black text-4xl sm:text-6xl quiz-gradient-text leading-tight">{t.title}</h2>
          </div>
        </div>
        <p className="text-[#2B0A0B]/70 text-lg sm:text-xl mb-6">{t.sub}</p>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <Stat label="النقاط" value={r.score.toLocaleString("en")} />
          <Stat label="إجابات صحيحة" value={`${r.correct}/${r.total}`} />
          <Stat label="ترتيبك" value={r.rank ? `#${r.rank}` : "-"} />
        </div>
        {r.toTop > 0 && (
          <p className="mb-6 rounded-2xl bg-[#600B0D]/5 border border-[#600B0D]/10 px-4 py-3 text-[#600B0D] font-semibold">
            <Target className="inline w-5 h-5 ml-1 -mt-1" />
            ينقصك <b className="tabular-nums">{r.toTop.toLocaleString("en")}</b> نقطة فقط لتتصدّر اللوحة!
          </p>
        )}

        {/* الأوسمة */}
        <p className="font-display font-extrabold text-xl mb-3">أوسمتك</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-7">
          {MODE_BADGES[r.mode].map((id, i) => {
            const b = BADGES[id];
            const got = r.badges.includes(id);
            return (
              <div key={id} style={{ animationDelay: `${300 + i * 150}ms` }}
                className={`rounded-2xl border p-3 flex items-center gap-3 ${got
                  ? "border-amber-400/60 bg-amber-50 quiz-badge" : "border-[#600B0D]/10 bg-white/60 opacity-50"}`}>
                <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${got ? "bg-amber-400 text-amber-950" : "bg-[#600B0D]/10 text-[#2B0A0B]/40"}`}>
                  {got ? <b.Icon className="w-5 h-5" /> : <Lock className="w-4 h-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block font-bold text-sm leading-tight">{b.title}</span>
                  <span className="block text-xs text-[#2B0A0B]/55 leading-tight mt-0.5">{b.desc}</span>
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <button onClick={onAgain}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#600B0D] text-white font-display font-black text-xl px-7 py-4 hover:bg-[#7A1518] active:scale-95 transition">
            <RotateCcw className="w-5 h-5" /> العب مرة أخرى
          </button>
          <button onClick={onOther}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-[#600B0D] text-[#600B0D] font-bold text-lg px-6 py-4 hover:bg-[#600B0D]/5 transition">
            <Repeat className="w-5 h-5" /> جرّب {r.mode === "classic" ? "جولة البرق" : "التحدي الكلاسيكي"}
          </button>
          <button onClick={onHome}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-[#600B0D]/15 font-bold text-lg px-6 py-4 hover:bg-[#600B0D]/5 transition">
            الزائر التالي
          </button>
        </div>
        <p className="text-[#2B0A0B]/35 text-sm mt-5">ستعود الشاشة للبداية تلقائياً بعد قليل</p>
      </div>

      <div className="flex flex-col gap-5 min-w-0">
        <Leaderboard board={board} mode={r.mode} highlightAt={r.at} />
        <FactCard />
      </div>
    </div>
  );
}

/* ───────── لوحة الأبطال ───────── */
function Leaderboard({ board, mode, onTab, highlightAt, onClear }: {
  board: ScoreEntry[]; mode: Mode; onTab?: (m: Mode) => void; highlightAt?: number; onClear?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(t);
  }, [confirming]);
  const top = rankBoard(board, mode).slice(0, 8);
  const medal = ["bg-amber-400 text-amber-950", "bg-slate-300 text-slate-800", "bg-orange-300 text-orange-900"];
  return (
    <div className="rounded-3xl border border-[#600B0D]/10 bg-white shadow-[0_20px_50px_-25px_rgba(96,11,13,.35)] p-5 sm:p-6 quiz-pop">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="font-display font-extrabold text-xl flex items-center gap-2">
          <Medal className="w-6 h-6 text-[#600B0D]" /> لوحة الأبطال
        </h3>
        {onClear && board.length > 0 && (
          <button aria-label="مسح النتائج"
            onClick={() => { if (confirming) { setConfirming(false); onClear(); } else setConfirming(true); }}
            className={`inline-flex items-center gap-1.5 text-sm p-1.5 rounded-lg transition ${
              confirming ? "bg-rose-50 text-rose-700 px-3" : "text-[#2B0A0B]/25 hover:text-rose-700"}`}>
            <Trash2 className="w-4 h-4" />
            {confirming && "اضغط مرة أخرى للمسح"}
          </button>
        )}
      </div>
      {onTab ? (
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#600B0D]/5 mb-4">
          {(["classic", "blitz"] as Mode[]).map((m) => (
            <button key={m} onClick={() => onTab(m)}
              className={`rounded-lg py-2 text-sm font-bold transition ${mode === m ? "bg-white text-[#600B0D] shadow-sm" : "text-[#2B0A0B]/50"}`}>
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[#2B0A0B]/50 -mt-2 mb-3">{MODE_LABELS[mode]}</p>
      )}
      {top.length === 0 ? (
        <p className="text-[#2B0A0B]/45 text-center py-8">كن أول من يسجّل اسمه هنا!</p>
      ) : (
        <ol className="space-y-2">
          {top.map((e, i) => {
            const A = AVATARS[e.avatar ?? 0] ?? AVATARS[0];
            return (
              <li key={e.at} style={{ animationDelay: `${i * 50}ms` }}
                className={`quiz-row flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                  e.at === highlightAt ? "bg-[#600B0D]/10 border border-[#600B0D]/40 quiz-highlight" : "bg-[#FBF6EF]"}`}>
                <span className={`w-7 h-7 rounded-full grid place-items-center font-display font-black text-sm ${medal[i] ?? "text-[#2B0A0B]/40"}`}>{i + 1}</span>
                <span className="w-8 h-8 rounded-lg grid place-items-center text-white shrink-0" style={{ background: A.bg }}>
                  <A.Icon className="w-4 h-4" />
                </span>
                <span className="flex-1 truncate font-semibold" dir="auto">{e.name}</span>
                <span className="text-[#2B0A0B]/40 text-sm tabular-nums">{e.correct}/{e.total}</span>
                <span className="font-display font-black tabular-nums text-[#600B0D] w-14 text-left">{e.score}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function FactCard() {
  const [i, setI] = useState(() => Math.floor(Math.random() * FUN_FACTS.length));
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % FUN_FACTS.length), 7000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="rounded-3xl bg-[#600B0D] text-white p-5 sm:p-6 relative overflow-hidden">
      <Lightbulb aria-hidden className="absolute -left-4 -bottom-4 w-28 h-28 text-white/10" />
      <p className="flex items-center gap-2 font-display font-extrabold text-lg mb-2 text-amber-200">
        <Lightbulb className="w-5 h-5" /> هل تعلم؟
      </p>
      <p key={i} className="text-lg leading-relaxed quiz-pop relative">{FUN_FACTS[i]}</p>
    </div>
  );
}

/* ───────── مكوّنات صغيرة ───────── */
function Lifeline({ Icon, label, used, onClick }: { Icon: typeof Trophy; label: string; used: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={used}
      className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2.5 font-bold transition ${used
        ? "border-[#600B0D]/10 text-[#2B0A0B]/30 line-through"
        : "border-[#600B0D]/25 bg-white text-[#600B0D] hover:bg-[#600B0D] hover:text-white hover:-translate-y-0.5 active:scale-95"}`}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}

function TimerRing({ left, max }: { left: number; max: number }) {
  const r = 26, c = 2 * Math.PI * r;
  const frac = Math.min(1, Math.max(0, left / max));
  const color = left <= 5 ? "#e11d48" : left <= 10 ? "#d97706" : "#059669";
  return (
    <div className={`relative w-16 h-16 ${left <= 5 ? "quiz-shake-soft" : ""}`} aria-label={`متبقي ${left} ثانية`}>
      <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
        <circle cx="32" cy="32" r={r} stroke="rgba(96,11,13,.1)" strokeWidth="6" fill="none" />
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
    <span className={`inline-flex items-center gap-2 rounded-full border border-[#600B0D]/10 bg-white px-4 py-2 ${className}`}>
      {children}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#600B0D]/10 bg-white p-4 sm:p-5">
      <p className="font-display font-black text-2xl sm:text-4xl text-[#600B0D] tabular-nums">{value}</p>
      <p className="text-[#2B0A0B]/55 text-sm sm:text-base mt-1">{label}</p>
    </div>
  );
}

function IconBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-label={label} title={label}
      className="w-11 h-11 grid place-items-center rounded-xl border border-[#600B0D]/10 bg-white hover:bg-[#600B0D]/5 transition">
      {children}
    </button>
  );
}

const FLOATERS = [
  { Icon: Cpu, x: 6, y: 18, s: 56, d: 0 }, { Icon: Wifi, x: 88, y: 70, s: 64, d: 2 },
  { Icon: Smartphone, x: 14, y: 78, s: 48, d: 4 }, { Icon: Shield, x: 46, y: 88, s: 52, d: 1 },
  { Icon: Code2, x: 72, y: 12, s: 50, d: 3 }, { Icon: Bot, x: 34, y: 40, s: 44, d: 5 },
  { Icon: Rocket, x: 92, y: 36, s: 46, d: 2.5 }, { Icon: Atom, x: 58, y: 56, s: 40, d: 1.5 },
];

function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute -top-40 -right-40 w-[36rem] h-[36rem] rounded-full bg-[#600B0D]/10 blur-[120px] quiz-drift" />
      <div className="absolute -bottom-40 -left-40 w-[32rem] h-[32rem] rounded-full bg-[#C9A27A]/25 blur-[120px] quiz-drift-rev" />
      <div className="absolute inset-0 quiz-grid" />
      {FLOATERS.map(({ Icon, x, y, s, d }, i) => (
        <Icon key={i} className="absolute quiz-floater" strokeWidth={1.4}
          style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, color: BRAND, animationDelay: `-${d * 2}s` }} />
      ))}
    </div>
  );
}

function Confetti({ count }: { count: number }) {
  const pieces = useRef(
    Array.from({ length: count }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 1.8,
      dur: 2.5 + Math.random() * 2.5,
      color: ["#600B0D", "#A8383B", "#C9A27A", "#059669", "#F59E0B", "#8E2326"][Math.floor(Math.random() * 6)],
      size: 6 + Math.random() * 9,
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
.quiz-gradient-text{background:linear-gradient(90deg,#600B0D,#A8383B,#600B0D);background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:quiz-shine 4s linear infinite}
.quiz-grid{background-image:linear-gradient(rgba(96,11,13,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(96,11,13,.05) 1px,transparent 1px);background-size:48px 48px;mask-image:radial-gradient(ellipse at center,#000 30%,transparent 75%)}
.quiz-pop{animation:quiz-pop .45s cubic-bezier(.2,.9,.3,1.2) both}
.quiz-fade{animation:quiz-fade .2s both}
.quiz-option{animation:quiz-pop .4s cubic-bezier(.2,.9,.3,1.2) both}
.quiz-row{animation:quiz-slide .4s ease-out both}
.quiz-shake{animation:quiz-shake .45s}
.quiz-shake-soft{animation:quiz-shake .6s infinite}
.quiz-glow-ok{box-shadow:0 0 0 4px rgba(16,185,129,.15),0 0 40px rgba(16,185,129,.25)}
.quiz-pulse{animation:quiz-pulse 2s infinite}
.quiz-float{animation:quiz-float 3s ease-in-out infinite}
.quiz-bounce{animation:quiz-bounce .5s}
.quiz-flicker{animation:quiz-flicker 1s ease-in-out infinite}
.quiz-drift{animation:quiz-drift 14s ease-in-out infinite}
.quiz-drift-rev{animation:quiz-drift 18s ease-in-out infinite reverse}
.quiz-floater{opacity:.06;animation:quiz-floater 12s ease-in-out infinite}
.quiz-countdown{width:0;animation-name:quiz-countdown;animation-timing-function:linear;animation-fill-mode:forwards}
.quiz-confetti{animation-name:quiz-fall;animation-timing-function:linear;animation-fill-mode:forwards}
.quiz-count{animation:quiz-count .85s cubic-bezier(.2,.9,.3,1.3) both}
.quiz-reaction{animation:quiz-reaction 1.2s cubic-bezier(.2,.9,.3,1.2) forwards}
.quiz-rise{animation:quiz-rise 1.1s ease-out forwards}
.quiz-flash{animation:quiz-flash .6s ease-out forwards}
.quiz-flash-ok{background:radial-gradient(circle at center,rgba(16,185,129,.28),transparent 70%)}
.quiz-flash-bad{background:radial-gradient(circle at center,rgba(225,29,72,.22),transparent 70%)}
.quiz-vanish{animation:quiz-vanish .4s ease-out}
.quiz-badge{animation:quiz-badge .6s cubic-bezier(.2,.9,.3,1.4) both}
.quiz-record{animation:quiz-pop .5s both,quiz-glow 1.6s ease-in-out infinite}
.quiz-highlight{animation:quiz-glow 1.6s ease-in-out 3}
.quiz-shimmer{background-image:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.8) 50%,transparent 70%);background-size:250% 100%;animation:quiz-shimmer 3s linear infinite}
@keyframes quiz-shine{to{background-position:200% center}}
@keyframes quiz-pop{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
@keyframes quiz-fade{from{opacity:0}}
@keyframes quiz-slide{from{opacity:0;transform:translateX(-16px)}}
@keyframes quiz-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}
@keyframes quiz-pulse{0%,100%{box-shadow:0 0 0 0 rgba(96,11,13,.35)}50%{box-shadow:0 0 0 14px rgba(96,11,13,0)}}
@keyframes quiz-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes quiz-bounce{0%{transform:scale(1)}40%{transform:scale(1.25)}100%{transform:scale(1.1)}}
@keyframes quiz-flicker{0%,100%{transform:scale(1) rotate(0)}50%{transform:scale(1.15) rotate(-6deg)}}
@keyframes quiz-drift{0%,100%{transform:translate(0,0)}50%{transform:translate(-60px,40px)}}
@keyframes quiz-floater{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-24px) rotate(8deg)}}
@keyframes quiz-countdown{from{width:0}to{width:100%}}
@keyframes quiz-fall{to{transform:translateY(110vh) rotate(720deg)}}
@keyframes quiz-count{0%{opacity:0;transform:scale(2.2)}60%{opacity:1;transform:scale(.92)}100%{transform:scale(1)}}
@keyframes quiz-reaction{0%{opacity:0;transform:scale(.4) rotate(-6deg)}20%{opacity:1;transform:scale(1.1) rotate(2deg)}35%{transform:scale(1) rotate(0)}80%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-30px)}}
@keyframes quiz-rise{0%{opacity:0;transform:translate(-50%,0)}20%{opacity:1}100%{opacity:0;transform:translate(-50%,-40px)}}
@keyframes quiz-flash{from{opacity:1}to{opacity:0}}
@keyframes quiz-vanish{0%{opacity:1;transform:scale(1)}100%{opacity:.3;transform:scale(.96)}}
@keyframes quiz-badge{from{opacity:0;transform:scale(.5) rotate(-8deg)}to{opacity:1;transform:none}}
@keyframes quiz-glow{0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,0)}50%{box-shadow:0 0 0 8px rgba(245,158,11,.25)}}
@keyframes quiz-shimmer{from{background-position:150% 0}to{background-position:-100% 0}}
@media (prefers-reduced-motion:reduce){.quiz-root *{animation:none!important}}
`;
