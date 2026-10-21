import { AppleMark } from '@/components/store/StorePaymentOptions';

// Small brand marks for the till's payment tiles, sized to sit under a label
export const MadaMark = () => (
  <span className="inline-flex flex-col items-center leading-none" dir="ltr">
    <span className="flex gap-px mb-px">
      <span className="h-[2px] w-2.5 rounded-full bg-[#259bd6]" />
      <span className="h-[2px] w-1.5 rounded-full bg-[#84b740]" />
    </span>
    <span className="text-[8px] font-extrabold tracking-tight text-[#004b7c] dark:text-[#5fb6e8]">mada</span>
  </span>
);

export const VisaMark = () => (
  <span className="text-[8px] font-black italic tracking-tight text-[#1a1f71] dark:text-[#8f9cff] leading-none" dir="ltr">VISA</span>
);

export const MastercardMark = () => (
  <span className="relative inline-flex w-[15px] h-2.5" dir="ltr">
    <span className="absolute left-0 top-0 w-2.5 h-2.5 rounded-full bg-[#eb001b]" />
    <span className="absolute right-0 top-0 w-2.5 h-2.5 rounded-full bg-[#f79e1b] mix-blend-multiply dark:mix-blend-screen" />
  </span>
);

export const ApplePayMark = () => (
  <span className="inline-flex items-center gap-px rounded-[3px] bg-black px-1 py-px text-[8px] font-semibold text-white leading-none" dir="ltr">
    <AppleMark className="w-[7px] h-[8px] -mt-px" />Pay
  </span>
);

export const TabbyMark = () => (
  <span className="rounded-[3px] bg-[#3bffc1] px-1 text-[8px] font-extrabold text-black leading-[11px]" dir="ltr">tabby</span>
);

export const TamaraMark = () => (
  <span className="text-[8px] font-bold bg-gradient-to-l from-[#f6a37a] via-[#e77fb7] to-[#8f7ff0] bg-clip-text text-transparent leading-none" dir="ltr">tamara</span>
);
