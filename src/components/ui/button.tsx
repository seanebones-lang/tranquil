import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "ghost" | "subtle";
type ButtonSize = "default" | "lg";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-sage)] text-white hover:bg-[var(--color-sage-deep)] active:translate-y-[0.5px]",
  ghost:
    "bg-transparent text-[var(--color-ink)] hover:bg-[var(--color-surface)]",
  subtle:
    "bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-surface-strong)]",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-base",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = "primary", size = "default", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium tracking-[0.01em]",
          "transition-colors duration-[var(--duration-fade)] ease-[var(--ease-tranquil)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-sage)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-paper)]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);
