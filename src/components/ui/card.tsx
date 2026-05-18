import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-[var(--color-surface)] rounded-[var(--radius-lg)] p-8",
        "shadow-[var(--shadow-soft)]",
        "transition-shadow duration-[var(--duration-fade)] ease-[var(--ease-tranquil)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-xl tracking-tight text-[var(--color-ink)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "text-[var(--color-muted)] text-sm mt-1 font-[var(--font-ui)]",
        className,
      )}
      {...props}
    />
  );
}
