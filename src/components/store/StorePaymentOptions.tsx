import type { ReactNode } from 'react';
import { Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STORE_PAYMENT_METHODS, type StorePaymentMethod } from '@/lib/storePayments';

// The brands' marks, drawn here so the checkout needs no image files
export const AppleMark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 17 20" className={className} fill="currentColor" aria-hidden>
    <path d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9C3.6 4.8 2 5.8 1.1 7.4c-1.9 3.2-.5 8 1.3 10.6.9 1.3 1.9 2.7 3.3 2.6 1.3-.1 1.8-.9 3.4-.9s2 .9 3.4.8c1.4 0 2.3-1.3 3.2-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.9-1.1-3-4.3ZM11.5 3c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.1 1.1.1 2.3-.6 3-1.5Z" />
  </svg>
);

const LOGOS: Record<StorePaymentMethod, ReactNode> = {
  apple_pay: (
    <span className="inline-flex items-center gap-0.5 text-[22px] font-semibold text-black dark:text-white" dir="ltr">
      <AppleMark className="w-[18px] h-[18px] -mt-1" />Pay
    </span>
  ),
  mada: (
    <span className="inline-flex flex-col items-center leading-none" dir="ltr">
      <span className="flex gap-0.5 mb-1">
        <span className="h-1.5 w-7 rounded-full bg-[#259bd6]" />
        <span className="h-1.5 w-4 rounded-full bg-[#84b740]" />
      </span>
      <span className="text-xl font-extrabold tracking-tight text-[#004b7c] dark:text-[#5fb6e8]">mada</span>
    </span>
  ),
  card: (
    <span className="inline-flex items-center gap-2" dir="ltr">
      <span className="text-xl font-black italic tracking-tight text-[#1a1f71] dark:text-[#8f9cff]">VISA</span>
      <span className="relative inline-flex w-9 h-6">
        <span className="absolute left-0 top-0 w-6 h-6 rounded-full bg-[#eb001b]" />
        <span className="absolute right-0 top-0 w-6 h-6 rounded-full bg-[#f79e1b] mix-blend-multiply dark:mix-blend-screen" />
      </span>
    </span>
  ),
  tamara: (
    <span className="text-xl font-bold bg-gradient-to-l from-[#f6a37a] via-[#e77fb7] to-[#8f7ff0] bg-clip-text text-transparent" dir="ltr">tamara</span>
  ),
  tabby: (
    <span className="inline-flex items-center rounded-md bg-[#3bffc1] px-2.5 py-0.5 text-lg font-extrabold text-black" dir="ltr">tabby</span>
  ),
  cod: <Banknote className="w-8 h-8 text-emerald-600" />,
};

/** The checkout's payment step: branded tiles, two to a row, as on Saudi stores. */
export function StorePaymentOptions({
  value,
  onChange,
}: {
  value: string;
  onChange: (method: StorePaymentMethod) => void;
}) {
  return (
    <div role="radiogroup" aria-label="طريقة الدفع" className="grid grid-cols-2 gap-3">
      {STORE_PAYMENT_METHODS.map(m => {
        const selected = value === m.value;
        return (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={m.soon || undefined}
            disabled={m.soon}
            onClick={() => onChange(m.value)}
            className={cn(
              'relative flex flex-col items-center justify-center gap-2 min-h-[104px] p-3 rounded-2xl border-2 bg-card transition-colors',
              selected ? 'border-[hsl(var(--store-primary))] bg-[hsl(var(--store-primary)/0.06)]' : 'border-border hover:border-muted-foreground/40',
              m.soon && 'opacity-60 cursor-not-allowed hover:border-border',
            )}
          >
            <span
              className={cn(
                'absolute top-3 start-3 w-5 h-5 rounded-full border-2 flex items-center justify-center',
                selected ? 'border-[hsl(var(--store-primary))]' : 'border-muted-foreground/40',
              )}
            >
              {selected && <span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--store-primary))]" />}
            </span>
            {m.soon && (
              <span className="absolute top-2.5 end-2.5 text-[10px] font-semibold bg-muted text-muted-foreground rounded-full px-2 py-0.5">قريباً</span>
            )}
            <span className="h-9 flex items-center">{LOGOS[m.value]}</span>
            <span className="text-sm font-medium text-foreground">{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}
