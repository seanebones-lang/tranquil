"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function ChatWidgetFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ask the app"
        className={cn(
          "fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40",
          "w-14 h-14 rounded-full",
          "bg-[var(--color-sage)] text-white",
          "flex items-center justify-center",
          "shadow-[var(--shadow-lifted)]",
          "transition-all duration-[var(--duration-fade)] ease-[var(--ease-tranquil)]",
          "hover:bg-[var(--color-sage-deep)] hover:scale-105",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-sage)]/30",
        )}
      >
        <ChatIcon className="w-6 h-6" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-[var(--color-ink)]/30 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => setOpen(false)}
        >
          <div
            className={cn(
              "w-full sm:max-w-md sm:mx-4 bg-[var(--color-surface)]",
              "rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-xl)]",
              "p-8 shadow-[var(--shadow-lifted)]",
              "max-h-[80dvh] overflow-y-auto",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl mb-3">Ask the app</h2>
            <p className="text-[var(--color-muted)] mb-6">
              In a moment, you'll be able to ask anything: search your notes,
              look up a verse, find a hadith, or pull recent news. Coming in
              Phase 5.
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm font-[var(--font-ui)] text-[var(--color-sage-deep)]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ChatIcon({ className }: { className?: string }) {
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
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
