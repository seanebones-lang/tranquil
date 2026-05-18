import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, type = "text", ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-12 w-full rounded-[var(--radius-md)] px-4 py-2",
        "bg-[var(--color-paper)] border border-[var(--color-surface-strong)]",
        "text-base text-[var(--color-ink)] placeholder:text-[var(--color-whisper)]",
        "font-[var(--font-ui)]",
        "transition-[border-color,box-shadow] duration-[var(--duration-fade)] ease-[var(--ease-tranquil)]",
        "focus-visible:outline-none focus-visible:border-[var(--color-sage)] focus-visible:ring-2 focus-visible:ring-[var(--color-sage)]/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
