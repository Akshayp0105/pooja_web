import { useEffect, useState } from 'react';
import { UNLOCK_AT } from '../lib/config';

export function useNow(interval = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}

export function useUnlocked() {
  return useNow() >= UNLOCK_AT.getTime();
}
