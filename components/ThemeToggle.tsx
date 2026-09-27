'use client';

import { useSyncExternalStore } from 'react';
import { currentTheme, setTheme, subscribeTheme } from '@/lib/theme';
import { Moon, Sun } from '@/components/icons';

/**
 * Light or dark, as one icon in the top-right corner: a moon while the screen
 * is light, a sun while it is dark — the icon is where tapping takes you.
 *
 * The server cannot know the theme (it lives in the browser), so the server
 * render draws an empty 44px slot and the icon appears on hydration; the page
 * colours are already right by then, because the head script set them before
 * paint.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => null);
  const next = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next}`}
      className={`inline-flex h-11 w-11 flex-none items-center justify-center text-ink-dim active:opacity-60 ${className}`}
    >
      {theme === 'dark' ? <Sun /> : theme === 'light' ? <Moon /> : null}
    </button>
  );
}
