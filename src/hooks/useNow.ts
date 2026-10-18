import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { UNLOCK_AT } from '../lib/config';

// One shared timer per interval for the whole page, instead of one per
// component. A timer only runs while something is listening.
type Clock = { now: number; listeners: Set<() => void>; timer: number | null };
const clocks = new Map<number, Clock>();

function clock(interval: number): Clock {
  let c = clocks.get(interval);
  if (!c) {
    c = { now: Date.now(), listeners: new Set(), timer: null };
    clocks.set(interval, c);
  }
  return c;
}

function subscribe(interval: number, cb: () => void) {
  const c = clock(interval);
  c.listeners.add(cb);
  if (c.timer === null) {
    // Don't touch c.now here: changing the snapshot while subscribing would
    // make React re-render and re-subscribe forever.
    c.timer = window.setInterval(() => {
      c.now = Date.now();
      c.listeners.forEach((l) => l());
    }, interval);
  }
  return () => {
    c.listeners.delete(cb);
    if (!c.listeners.size && c.timer !== null) {
      clearInterval(c.timer);
      c.timer = null;
    }
  };
}

export function useNow(interval = 1000) {
  // Stable functions, so React subscribes once per component, not every render.
  const sub = useCallback((cb: () => void) => subscribe(interval, cb), [interval]);
  const snap = useCallback(() => clock(interval).now, [interval]);
  return useSyncExternalStore(sub, snap);
}

/** Flips to true at the unlock moment with a single timeout; no per-second re-renders. */
export function useUnlocked() {
  const [unlocked, setUnlocked] = useState(() => Date.now() >= UNLOCK_AT.getTime());
  const [check, setCheck] = useState(0);
  useEffect(() => {
    if (unlocked) return;
    // setTimeout can't wait longer than ~24.8 days, so wake at least daily.
    const ms = Math.min(UNLOCK_AT.getTime() - Date.now() + 50, 86_400_000);
    const t = setTimeout(() => {
      if (Date.now() >= UNLOCK_AT.getTime()) setUnlocked(true);
      else setCheck((n) => n + 1);
    }, Math.max(0, ms));
    return () => clearTimeout(t);
  }, [unlocked, check]);
  return unlocked;
}
