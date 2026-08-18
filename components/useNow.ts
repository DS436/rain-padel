'use client';

import { useEffect, useState } from 'react';

/**
 * Wall-clock ticker for the countdown.
 *
 * The visibilitychange listener matters more than the interval: iOS throttles
 * background timers hard, so on unlock the interval may be a minute stale. This
 * repaints the moment the phone comes back, before the next tick.
 */
export function useNow(intervalMs = 250, active = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    tick();

    const id = window.setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [intervalMs, active]);

  return now;
}
