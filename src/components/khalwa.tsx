"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Khalwa mode — a "retreat" or "solitude" mode for distraction-free writing.
 *
 * When active, the wrapped content is rendered fullscreen on a paper-colored
 * canvas with all chrome (nav, side panel, status indicators) suppressed.
 * Press Escape to exit.
 */
export function KhalwaButton({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onToggle();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, onToggle]);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={active ? "Exit khalwa mode" : "Enter khalwa mode"}
      title="Khalwa — distraction-free writing"
      className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
        active
          ? "bg-[var(--color-sage)] text-white"
          : "text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]",
      )}
    >
      <ExpandIcon className="w-4 h-4" />
    </button>
  );
}

export function KhalwaShell({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  // Prevent body scroll when active
  useEffect(() => {
    if (!active) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [active]);

  if (!active) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-40 bg-[var(--color-paper)] overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 sm:px-10 pt-12 pb-32">
        {children}
      </div>
    </div>
  );
}

function ExpandIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

// Hook for a clean toggle interface
export function useKhalwa() {
  const [active, setActive] = useState(false);
  return {
    active,
    toggle: () => setActive((v) => !v),
    setActive,
  };
}
