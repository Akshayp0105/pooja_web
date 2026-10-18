import { motion } from 'framer-motion';
import { Check, Mic, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const BARS = 32;
const MAX_SECONDS = 600;

function extFor(mime: string) {
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
}

export function VoiceRecorder({ onDone, onCancel }: { onDone: (file: File) => void; onCancel: () => void }) {
  const [state, setState] = useState<'starting' | 'recording' | 'denied'>('starting');
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0.08));
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const keep = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let raf = 0;
    let timer = 0;
    let cancelled = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        const rec = new MediaRecorder(stream);
        recorder.current = rec;
        rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
        rec.onstop = () => {
          stream?.getTracks().forEach((t) => t.stop());
          if (!keep.current || !chunks.current.length) return;
          const mime = rec.mimeType || 'audio/webm';
          const stamp = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }).replace(/\W+/g, '-');
          onDone(new File(chunks.current, `Voice note ${stamp}.${extFor(mime)}`, { type: mime.split(';')[0] }));
        };
        rec.start(250);

        ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        let last = 0;
        const tick = (t: number) => {
          raf = requestAnimationFrame(tick);
          if (t - last < 70) return;
          last = t;
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((s, v) => s + v, 0) / data.length / 255;
          setLevels((prev) => [...prev.slice(1), Math.min(1, 0.08 + avg * 2.4)]);
        };
        raf = requestAnimationFrame(tick);

        const started = Date.now();
        timer = window.setInterval(() => {
          const s = Math.floor((Date.now() - started) / 1000);
          setSeconds(s);
          if (s >= MAX_SECONDS) stop(true);
        }, 250);
        setState('recording');
      } catch {
        setState('denied');
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearInterval(timer);
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stop(save: boolean) {
    keep.current = save;
    if (recorder.current?.state === 'recording') recorder.current.stop();
    if (!save) onCancel();
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  if (state === 'denied') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-lotus/40 bg-lotus-soft/60 px-4 py-3 text-sm text-maroon">
        Microphone access was blocked. Allow it in your browser to record a voice note.
        <button type="button" onClick={onCancel} className="rounded-full p-1.5 hover:bg-white/70" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 rounded-2xl border border-saffron/25 bg-gradient-to-r from-white to-parchment/70 p-2.5 pl-4"
    >
      <span className="relative flex h-3 w-3 shrink-0">
        <span className="animate-ripple absolute inline-flex h-full w-full rounded-full bg-saffron" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-saffron" />
      </span>
      <span className="w-12 shrink-0 font-display text-lg font-semibold tabular-nums text-maroon">
        {mm}:{ss}
      </span>
      <div className="flex h-9 flex-1 items-center gap-[3px] overflow-hidden" aria-hidden>
        {levels.map((l, i) => (
          <span
            key={i}
            className="w-[3px] shrink-0 rounded-full bg-gradient-to-t from-saffron to-marigold transition-[height] duration-100"
            style={{ height: `${Math.round(l * 100)}%` }}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => stop(false)}
        className="rounded-full p-2.5 text-muted transition hover:bg-white hover:text-maroon"
        aria-label="Discard recording"
      >
        <X className="h-4 w-4" />
      </button>
      <button
        type="button"
        disabled={state !== 'recording'}
        onClick={() => stop(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-maroon px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-maroon/90 disabled:opacity-50"
      >
        {state === 'recording' ? <Check className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        {state === 'recording' ? 'Add voice' : 'Starting'}
      </button>
    </motion.div>
  );
}
