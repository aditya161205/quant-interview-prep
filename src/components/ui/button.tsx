import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  // The hardcoded accent ring hung a second, slightly-off edge around every
  // primary button; the shadow now just lifts it off the surface.
  primary: "bg-accent text-accent-foreground shadow-(--shadow-raised) hover:opacity-90",
  secondary: "bg-surface-2 text-foreground hover:bg-border",
  outline: "border border-border bg-transparent hover:bg-surface-2 hover:border-foreground/20",
  ghost: "bg-transparent hover:bg-surface-2",
};

// Chunkier than before: actions were reading as secondary chrome next to the
// content. Generous horizontal padding is what gives them presence.
const sizes: Record<Size, string> = {
  sm: "h-9 gap-1.5 px-4 text-sm",
  md: "h-11 px-5 text-[0.9375rem]",
  lg: "h-12 px-7 text-base",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        // Rounded rectangles, not pills: pills are the language of chips and
        // nav here, so actions need their own shape to read as actions.
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold",
        // Expo-out easing and a small press scale, per the motion guidance:
        // 150-300ms, and the press should be felt rather than seen.
        "transition-[background-color,border-color,color,opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
