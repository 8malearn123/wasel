import { forwardRef, type SVGProps } from 'react';

/**
 * The Saudi Riyal symbol, drawn like a lucide icon (24×24, stroked,
 * currentColor) so it drops in wherever DollarSign was: same className,
 * size and strokeWidth props.
 */
export const RiyalSign = forwardRef<
  SVGSVGElement,
  SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string }
>(({ size = 24, strokeWidth = 2, ...props }, ref) => (
  <svg
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    {...props}
  >
    {/* the left upright runs into a base slanted like the bars; the right one stops short */}
    <path d="M9 2v15l5.5-1.2" />
    <path d="M14.5 3.5v9.3" />
    {/* the two slanted bars across both, and the short one at the foot */}
    <path d="M3.5 9.8 20.5 6.1" />
    <path d="M3.5 14.2 20.5 10.5" />
    <path d="M16 20 21 18.9" />
  </svg>
));
RiyalSign.displayName = 'RiyalSign';
