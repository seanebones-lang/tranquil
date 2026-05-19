"use client";

import { useEffect, useState, useTransition } from "react";
import { updateSettings, revokeActiveHeirloomGrants } from "@/app/actions/settings";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Initial = {
  fontScale: number;
  contrast: "standard" | "high";
  reducedMotion: boolean;
  ambientSound: string | null;
  heirloomContactEmail: string | null;
  heirloomUnlockAfterDays: number;
};

type Grant = {
  id: string;
  heirEmail: string;
  createdAt: string;
  expiresAt: string;
  unlockedAt: string | null;
};

const FONT_OPTIONS = [
  { value: 1.0, label: "Default" },
  { value: 1.1, label: "Larger" },
  { value: 1.25, label: "Even larger" },
  { value: 1.4, label: "Largest" },
];

const AMBIENT_OPTIONS = [
  { value: null, label: "None" },
  { value: "rain", label: "Rain" },
  { value: "wind", label: "Wind" },
  { value: "recitation", label: "Quiet recitation" },
];

export function SettingsForm({
  initial,
  activeGrants,
}: {
  initial: Initial;
  activeGrants: Grant[];
}) {
  const [state, setState] = useState(initial);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Apply font scale + reduced motion to root html immediately for live preview
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("data-font-scale", String(state.fontScale));
    html.setAttribute("data-reduced-motion", String(state.reducedMotion));
    html.setAttribute("data-contrast", state.contrast);
  }, [state.fontScale, state.reducedMotion, state.contrast]);

  const persist = (patch: Partial<Initial>) => {
    setError(null);
    setSavedAt(null);
    const next = { ...state, ...patch };
    setState(next);
    startTransition(async () => {
      try {
        await updateSettings(patch);
        setSavedAt(Date.now());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  };

  return (
    <div className="space-y-12">
      {/* Accessibility */}
      <section>
        <h2 className="text-xs uppercase tracking-[0.18em] text-[var(--color-whisper)] font-[var(--font-ui)] mb-4">
          Reading
        </h2>
        <Card className="space-y-6">
          <div>
            <label className="block text-sm font-[var(--font-ui)] text-[var(--color-muted)] mb-3">
              Text size
            </label>
            <div className="flex gap-2 flex-wrap">
              {FONT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => persist({ fontScale: opt.value })}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-[var(--font-ui)] transition-colors",
                    state.fontScale === opt.value
                      ? "bg-[var(--color-sage)] text-white"
                      : "bg-[var(--color-paper)] text-[var(--color-muted)] hover:text-[var(--color-ink)]",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={state.reducedMotion}
                onChange={(e) => persist({ reducedMotion: e.target.checked })}
                className="w-4 h-4 accent-[var(--color-sage)]"
              />
              <span className="text-sm font-[var(--font-ui)] text-[var(--color-ink)]">
                Reduce motion
              </span>
            </label>
            <p className="text-xs text-[var(--color-whisper)] font-[var(--font-ui)] mt-1 ml-7">
              Removes animations and transitions throughout the app.
            </p>
          </div>

          <div>
            <label className="block text-sm font-[var(--font-ui)] text-[var(--color-muted)] mb-3">
              Ambient sound in focus mode
            </label>
            <div className="flex gap-2 flex-wrap">
              {AMBIENT_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => persist({ ambientSound: opt.value })}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-[var(--font-ui)] transition-colors",
                    state.ambientSound === opt.value
                      ? "bg-[var(--color-sage)] text-white"
                      : "bg-[var(--color-paper)] text-[var(--color-muted)] hover:text-[var(--color-ink)]",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </section>

      {/* Heirloom */}
      <section>
        <h2 className="text-xs uppercase tracking-[0.18em] text-[var(--color-whisper)] font-[var(--font-ui)] mb-4">
          Heirloom
        </h2>
        <Card className="space-y-6">
          <p className="text-base leading-relaxed text-[var(--color-ink)] italic font-[var(--font-body)]">
            If you ever stop signing in to this app for a long while, we can send
            your notes — read-only — to someone you trust. They'll get a quiet
            email with a private link.
          </p>

          <div>
            <label
              htmlFor="heirEmail"
              className="block text-sm font-[var(--font-ui)] text-[var(--color-muted)] mb-2"
            >
              Trusted contact's email
            </label>
            <Input
              id="heirEmail"
              type="email"
              value={state.heirloomContactEmail ?? ""}
              onChange={(e) =>
                setState({
                  ...state,
                  heirloomContactEmail: e.target.value || null,
                })
              }
              onBlur={() =>
                persist({
                  heirloomContactEmail: state.heirloomContactEmail?.trim() || null,
                })
              }
              placeholder="someone@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-[var(--font-ui)] text-[var(--color-muted)] mb-3">
              Send after this many days of inactivity
            </label>
            <div className="flex gap-2 flex-wrap">
              {[180, 365, 730, 1095].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => persist({ heirloomUnlockAfterDays: days })}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-[var(--font-ui)] transition-colors",
                    state.heirloomUnlockAfterDays === days
                      ? "bg-[var(--color-sage)] text-white"
                      : "bg-[var(--color-paper)] text-[var(--color-muted)] hover:text-[var(--color-ink)]",
                  )}
                >
                  {days === 180 ? "6 months" : days === 365 ? "1 year" : days === 730 ? "2 years" : "3 years"}
                </button>
              ))}
            </div>
          </div>

          {activeGrants.length > 0 && (
            <div className="pt-4 border-t border-[var(--color-surface-strong)]">
              <p className="text-xs uppercase tracking-[0.15em] text-[var(--color-whisper)] font-[var(--font-ui)] mb-3">
                Active grants
              </p>
              <ul className="space-y-2">
                {activeGrants.map((g) => (
                  <li
                    key={g.id}
                    className="text-sm font-[var(--font-ui)] text-[var(--color-muted)]"
                  >
                    <strong className="text-[var(--color-ink)]">{g.heirEmail}</strong>{" "}
                    — expires {new Date(g.expiresAt).toLocaleDateString()}
                    {g.unlockedAt ? " · opened" : " · not yet opened"}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  if (!confirm("Revoke all active heirloom grants? This cannot be undone.")) return;
                  startTransition(async () => {
                    await revokeActiveHeirloomGrants();
                  });
                }}
                className="mt-4 text-sm text-[var(--color-danger)] hover:underline font-[var(--font-ui)]"
              >
                Revoke all
              </button>
            </div>
          )}
        </Card>
      </section>

      <SaveIndicator pending={pending} savedAt={savedAt} error={error} />
    </div>
  );
}

function SaveIndicator({
  pending,
  savedAt,
  error,
}: {
  pending: boolean;
  savedAt: number | null;
  error: string | null;
}) {
  if (error) {
    return (
      <p className="text-sm text-[var(--color-danger)] font-[var(--font-ui)]">
        {error}
      </p>
    );
  }
  if (pending) {
    return (
      <p className="text-xs text-[var(--color-whisper)] font-[var(--font-ui)]">
        Saving…
      </p>
    );
  }
  if (savedAt && Date.now() - savedAt < 3000) {
    return (
      <p className="text-xs text-[var(--color-sage-deep)] font-[var(--font-ui)]">
        Saved
      </p>
    );
  }
  return null;
}
