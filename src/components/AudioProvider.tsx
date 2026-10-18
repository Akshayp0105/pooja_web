import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { TRACKS, type Track } from '../lib/tracks';

const BG_VOLUME = 0.16;
const DUCKED = 0.03;

type AudioApi = {
  track: Track;
  playing: boolean;
  waiting: boolean;
  volume: number;
  play: (id?: string, volume?: number) => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  setVolume: (v: number) => void;
  duck: (on: boolean) => void;
};

const Ctx = createContext<AudioApi | null>(null);

export function useAudio() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAudio outside AudioProvider');
  return v;
}

/** Each visit starts on the next chant in the list, so it changes every time. */
function visitTrackIndex() {
  try {
    const last = Number(localStorage.getItem('pv:bg-track'));
    const idx = Number.isFinite(last) ? (last + 1) % TRACKS.length : 0;
    localStorage.setItem('pv:bg-track', String(idx));
    return idx;
  } catch {
    return Math.floor(Math.random() * TRACKS.length);
  }
}

function pausedThisSession() {
  try {
    return sessionStorage.getItem('pv:music-paused') === '1';
  } catch {
    return false;
  }
}

function rememberPaused(v: boolean) {
  try {
    sessionStorage.setItem('pv:music-paused', v ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function AudioProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [index, setIndex] = useState(visitTrackIndex);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [volume, setVol] = useState(BG_VOLUME);
  const volumeRef = useRef(BG_VOLUME);
  const ducked = useRef(false);
  const fade = useRef(0);
  // The tap that unlocks audio must not also count as a pause on the dock button.
  const gestureAt = useRef(0);

  const rampTo = useCallback((target: number, ms = 1600) => {
    const el = audio.current;
    if (!el) return;
    clearInterval(fade.current);
    const from = el.volume;
    const start = performance.now();
    fade.current = window.setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / ms);
      el.volume = from + (target - from) * t;
      if (t >= 1) clearInterval(fade.current);
    }, 40);
  }, []);

  const start = useCallback(async () => {
    const el = audio.current;
    if (!el) return false;
    try {
      el.volume = 0;
      await el.play();
      rampTo(ducked.current ? DUCKED : volumeRef.current);
      setWaiting(false);
      return true;
    } catch {
      return false;
    }
  }, [rampTo]);

  // Create the element once and try to start; browsers block sound until the
  // first tap or key press, so fall back to starting on that gesture.
  useEffect(() => {
    const el = new Audio(TRACKS[index].src);
    el.preload = 'auto';
    audio.current = el;
    el.addEventListener('play', () => setPlaying(true));
    el.addEventListener('pause', () => setPlaying(false));
    el.addEventListener('ended', () => setIndex((i) => (i + 1) % TRACKS.length));

    if (pausedThisSession()) return;
    let armed = false;
    const onGesture = () => {
      gestureAt.current = Date.now();
      removeGesture();
      if (!pausedThisSession()) start();
    };
    const removeGesture = () => {
      if (!armed) return;
      armed = false;
      ['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.removeEventListener(e, onGesture));
    };
    start().then((ok) => {
      if (ok) return;
      setWaiting(true);
      armed = true;
      ['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.addEventListener(e, onGesture, { once: true }));
    });
    return () => {
      removeGesture();
      el.pause();
      clearInterval(fade.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track changes after the first one: swap the source and keep playing.
  const mounted = useRef(false);
  useEffect(() => {
    const el = audio.current;
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!el) return;
    el.src = TRACKS[index].src;
    if (!pausedThisSession()) start();
  }, [index, start]);

  const api: AudioApi = {
    track: TRACKS[index],
    playing,
    waiting,
    volume,
    play: (id, v) => {
      if (typeof v === 'number') {
        volumeRef.current = v;
        setVol(v);
      }
      rememberPaused(false);
      const i = id ? TRACKS.findIndex((t) => t.id === id) : index;
      if (i >= 0 && i !== index) {
        setIndex(i);
      } else start();
    },
    pause: () => {
      rememberPaused(true);
      audio.current?.pause();
    },
    toggle: () => {
      if (Date.now() - gestureAt.current < 600) return;
      if (audio.current && !audio.current.paused) {
        rememberPaused(true);
        audio.current.pause();
      } else {
        rememberPaused(false);
        start();
      }
    },
    next: () => {
      rememberPaused(false);
      setIndex((i) => (i + 1) % TRACKS.length);
    },
    setVolume: (v) => {
      volumeRef.current = v;
      setVol(v);
      if (audio.current && !ducked.current) audio.current.volume = v;
    },
    duck: (on) => {
      ducked.current = on;
      rampTo(on ? DUCKED : volumeRef.current, 600);
    },
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
