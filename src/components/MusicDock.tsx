import { AnimatePresence, motion } from 'framer-motion';
import { ListMusic, Pause, Play, SkipForward, Volume1, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAudio } from './AudioProvider';
import { cn } from '../lib/cn';
import { TRACKS } from '../lib/tracks';

export function Bars({ active, className }: { active: boolean; className?: string }) {
  return (
    <span className={cn('flex h-4 items-end gap-[3px]', className)} aria-hidden>
      {[0.55, 1, 0.7, 0.9].map((h, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-gradient-to-t from-saffron to-marigold"
          animate={active ? { height: ['30%', `${h * 100}%`, '45%', `${h * 80}%`, '30%'] } : { height: '30%' }}
          transition={active ? { duration: 1.2 + i * 0.18, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
        />
      ))}
    </span>
  );
}

export function MusicDock() {
  const a = useAudio();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => panel.current && !panel.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  const VolIcon = a.volume === 0 ? VolumeX : a.volume < 0.35 ? Volume1 : Volume2;

  return (
    <motion.div
      ref={panel}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2, duration: 0.8 }}
      className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-4 z-50 sm:left-6"
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.25 }}
            className="absolute bottom-[calc(100%+10px)] left-0 w-[min(92vw,360px)] origin-bottom-left overflow-hidden rounded-3xl border border-gold/20 bg-white/90 shadow-lift backdrop-blur-xl"
          >
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <p className="text-[13px] font-semibold text-maroon">
                Chants <span className="font-ml normal-case tracking-normal text-saffron">· മന്ത്രങ്ങൾ</span>
              </p>
              <button onClick={() => setOpen(false)} className="rounded-full p-1.5 text-muted hover:bg-parchment" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="max-h-[50vh] overflow-y-auto px-2 pb-2">
              {TRACKS.map((t) => {
                const current = t.id === a.track.id;
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => (current ? a.toggle() : a.play(t.id))}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition',
                        current ? 'bg-[#FFF4E3]' : 'hover:bg-parchment/70',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                          current ? 'bg-saffron text-white' : 'bg-parchment text-maroon',
                        )}
                      >
                        {current && a.playing ? <Bars active className="!h-3.5 [&>span]:!from-white [&>span]:!to-white" /> : <Play className="ml-0.5 h-3.5 w-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-ink">{t.title}</span>
                        <span className="block truncate font-mlsans text-[12px] text-muted">{t.ml}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center gap-3 border-t border-gold/10 px-5 py-3">
              <VolIcon className="h-4 w-4 shrink-0 text-muted" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={a.volume}
                onChange={(e) => a.setVolume(Number(e.target.value))}
                className="h-1 w-full cursor-pointer accent-saffron"
                aria-label="Volume"
              />
            </div>
            <p className="border-t border-gold/10 px-5 py-2.5 text-[11px] leading-snug text-muted/80">
              Now: {a.track.artist} ·{' '}
              <a href={a.track.page} target="_blank" rel="noreferrer" className="underline decoration-gold/40 underline-offset-2">
                {a.track.license}
              </a>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-1 rounded-full border border-gold/20 bg-white/85 p-1.5 shadow-soft backdrop-blur-xl">
        <button
          onClick={a.toggle}
          className={cn(
            'relative flex h-10 w-10 items-center justify-center rounded-full text-white transition',
            'bg-gradient-to-br from-[#E8892A] to-[#C75D17] shadow-glow hover:scale-105',
          )}
          aria-label={a.playing ? 'Pause chant' : 'Play chant'}
        >
          {a.waiting && <span className="animate-ripple absolute inset-0 rounded-full border-2 border-saffron" />}
          {a.playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>
        <button onClick={() => setOpen((v) => !v)} className="flex min-w-0 items-center gap-2.5 rounded-full py-1 pl-2 pr-3 text-left hover:bg-parchment/60">
          <Bars active={a.playing} />
          <span className="hidden min-w-0 max-w-[200px] min-[420px]:block">
            <span className="block truncate text-[12.5px] font-semibold leading-tight text-ink">
              {a.waiting ? 'Tap anywhere for chants' : a.track.title}
            </span>
            <span className="block truncate font-mlsans text-[11px] leading-tight text-muted">{a.track.ml}</span>
          </span>
        </button>
        <button onClick={a.next} className="hidden rounded-full p-2.5 text-muted transition hover:bg-parchment hover:text-maroon sm:block" aria-label="Next chant">
          <SkipForward className="h-4 w-4" />
        </button>
        <button onClick={() => setOpen((v) => !v)} className="rounded-full p-2.5 text-muted transition hover:bg-parchment hover:text-maroon" aria-label="All chants">
          <ListMusic className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
