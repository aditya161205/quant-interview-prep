import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-jacket text-jacket-ink shadow-(--shadow-raised) hover:brightness-110",
  secondary: "bg-foreground text-background hover:bg-foreground/85",
  outline: "border-[1.5px] border-foreground bg-transparent text-foreground hover:bg-foreground hover:text-background",
  ghost: "bg-transparent hover:bg-surface-2",
};

const sizes: Record<Size, string> = {
  sm: "h-9 gap-1.5 px-4 text-sm",
  md: "h-11 px-5 text-[0.9375rem]",
  lg: "h-12 px-7 text-base",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "font-x inline-flex cursor-pointer items-center justify-center gap-2 rounded-[6px] font-bold tracking-[0.01em]",
        "transition-[background-color,border-color,color,filter,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
