'use client';

import { useSyncExternalStore } from 'react';
import { currentTheme, setTheme, subscribeTheme } from '@/lib/theme';

/**
 * The mock's own switch: one pill that says what tapping it will do —
 * "Switch to dark" in light, "Switch to light" in dark.
 *
 * The server cannot know the theme (it lives in the browser), so the server
 * render says nothing and the word appears on hydration; the page colours are
 * already right by then, because the head script set them before paint.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => null);
  const next = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={theme ? `Switch to ${next} mode` : 'Switch theme'}
      className={`inline-flex min-h-11 items-center ${className}`}
    >
      <span className="inline-flex h-8 min-w-[118px] items-center justify-center rounded-full border border-line bg-surface px-3.5 text-xs font-semibold text-ink">
        {theme ? `Switch to ${next}` : ' '}
      </span>
    </button>
  );
}
