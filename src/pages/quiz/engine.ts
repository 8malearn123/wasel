import { QUESTIONS, type QuizQuestion } from "./questions";

/* ───────── إعدادات اللعبة ───────── */
export const QUESTION_SECONDS = 20;
export const BLITZ_SECONDS = 60;
export const PICK_PER_LEVEL = { 1: 4, 2: 4, 3: 2 } as const; // 10 أسئلة للتحدي الكلاسيكي
export const AUTO_NEXT_MS = 7000;
export const BLITZ_NEXT_MS = 700;
export const RESULT_IDLE_MS = 45000;
export const PAUSE_IDLE_MS = 20000;
export const MAX_IDLE_TIMEOUTS = 3; // بعد 3 أسئلة بلا إجابة نعتبر الزائر غادر
const LB_KEY = "wasel-quiz-leaderboard";
const PLAYS_KEY = "ghirass-quiz-plays";

export type Mode = "classic" | "blitz";
export const MODE_LABELS: Record<Mode, string> = { classic: "التحدي الكلاسيكي", blitz: "جولة البرق" };

export interface RoundQuestion extends QuizQuestion {
  shuffled: string[];
  correctIndex: number;
}
export interface ScoreEntry {
  name: string; score: number; correct: number; total: number; at: number;
  mode?: Mode; avatar?: number;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function prepare(q: QuizQuestion): RoundQuestion {
  const shuffled = shuffle(q.options);
  return { ...q, shuffled, correctIndex: shuffled.indexOf(q.options[0]) };
}

export function buildClassicRound(): RoundQuestion[] {
  const picked: QuizQuestion[] = [];
  ([1, 2, 3] as const).forEach((lvl) => {
    picked.push(...shuffle(QUESTIONS.filter((q) => q.level === lvl)).slice(0, PICK_PER_LEVEL[lvl]));
  });
  return picked.map(prepare);
}

/** جولة البرق: كل الأسئلة بترتيب عشوائي، الأسهل أولاً تقريباً */
export function buildBlitzRound(): RoundQuestion[] {
  return shuffle(QUESTIONS)
    .map((q) => ({ q, k: q.level + Math.random() * 2 }))
    .sort((a, b) => a.k - b.k)
    .map(({ q }) => prepare(q));
}

export const modeOf = (e: ScoreEntry): Mode => e.mode ?? "classic";

export function rankBoard(board: ScoreEntry[], mode: Mode) {
  return board.filter((e) => modeOf(e) === mode).sort((a, b) => b.score - a.score || a.at - b.at);
}

export function loadBoard(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(LB_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
export function saveBoard(board: ScoreEntry[]) {
  try { localStorage.setItem(LB_KEY, JSON.stringify(board)); } catch { /* وضع التصفح الخاص */ }
}

const today = () => new Date().toDateString();
export function loadPlaysToday(): number {
  try {
    const raw = JSON.parse(localStorage.getItem(PLAYS_KEY) ?? "null");
    return raw?.date === today() ? Number(raw.count) || 0 : 0;
  } catch {
    return 0;
  }
}
export function bumpPlaysToday(): number {
  const count = loadPlaysToday() + 1;
  try { localStorage.setItem(PLAYS_KEY, JSON.stringify({ date: today(), count })); } catch { /* تجاهل */ }
  return count;
}

/* ───────── أصوات عبر Web Audio — لا تحتاج ملفات ───────── */
let audioCtx: AudioContext | null = null;
function beep(freqs: number[], dur = 0.12, type: OscillatorType = "sine", vol = 0.18) {
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
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    });
  } catch { /* المتصفح لا يدعم الصوت */ }
}
export const SFX = {
  correct: () => beep([660, 880, 1320], 0.1),
  streak: () => beep([784, 988, 1175, 1568], 0.08, "triangle"),
  wrong: () => beep([220, 160], 0.18, "square", 0.12),
  tick: () => beep([1000], 0.05, "triangle", 0.12),
  count: () => beep([600], 0.15, "triangle"),
  go: () => beep([880, 1320], 0.14, "triangle"),
  lifeline: () => beep([1200, 900, 1400], 0.07, "sine"),
  pick: () => beep([700], 0.04, "sine", 0.1),
  win: () => beep([523, 659, 784, 1047, 1319], 0.12),
  record: () => beep([523, 659, 784, 1047, 784, 1047, 1319, 1568], 0.11, "triangle"),
};
export type SfxKey = keyof typeof SFX;

/* ───────── عبارات تفاعلية ───────── */
export const CHEERS = ["رائع!", "عبقري!", "ممتاز!", "أحسنت!", "مذهل!", "إجابة ذكية!", "كفو!"];
export const OOPS = ["قريبة!", "ولا يهمك، التالي لك", "حظ أوفر", "ركّز، تقدر!"];
export const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

export function classicTitle(pct: number) {
  if (pct >= 90) return { title: "عبقري التقنية", sub: "أداء أسطوري! أنت من نخبة الخبراء." };
  if (pct >= 70) return { title: "خبير تقني", sub: "معرفة ممتازة، اقتربت من القمة." };
  if (pct >= 50) return { title: "متحمّس للتقنية", sub: "بداية قوية، استمر في التعلّم." };
  return { title: "مستكشف جديد", sub: "كل خبير كان مبتدئاً يوماً ما. جرّب مرة أخرى!" };
}
export function blitzTitle(correct: number) {
  if (correct >= 15) return { title: "برق لا يُوقف", sub: "سرعة ودقة خارقة!" };
  if (correct >= 10) return { title: "عاصفة تقنية", sub: "أداء سريع ومبهر." };
  if (correct >= 6) return { title: "سريع البديهة", sub: "جيد جداً، تقدر تكسر الرقم!" };
  return { title: "شرارة البداية", sub: "الجولة الجاية أقوى. جرّب مرة ثانية!" };
}
