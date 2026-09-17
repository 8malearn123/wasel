import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent p-0 transition-colors",
      "data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/25",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-sm ring-1 ring-black/5 transition-transform",
        // translateX knows nothing about direction, so in Arabic the thumb used
        // to slide off the track instead of across it
        "[--thumb-shift:1.25rem] rtl:[--thumb-shift:-1.25rem]",
        "data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-[var(--thumb-shift)]",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
