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
        // scaleY (a GPU transform) instead of height, so playing never forces a re-layout
        <motion.span
          key={i}
          className="h-full w-[3px] origin-bottom rounded-full bg-gradient-to-t from-saffron to-marigold"
          initial={{ scaleY: 0.3 }}
          animate={active ? { scaleY: [0.3, h, 0.45, h * 0.8, 0.3] } : { scaleY: 0.3 }}
          transition={active ? { duration: 1.2 + i * 0.18, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
        />
      ))}
    </span>
  );
}

/** A small vinyl record that spins while a chant plays. */
function Disc({ spinning, size = 44 }: { spinning: boolean; size?: number }) {
  return (
    <span className="relative block shrink-0" style={{ width: size, height: size }} aria-hidden>
      <span
        className="disc absolute inset-0 overflow-hidden rounded-full shadow-[0_4px_14px_-4px_rgba(42,26,18,.55)]"
        style={{
          animationPlayState: spinning ? 'running' : 'paused',
          background:
            'radial-gradient(circle at 50% 50%, #F3A53A 0 17%, #6A1F1B 17.5% 21%, transparent 21.5%),' +
            'repeating-radial-gradient(circle at 50% 50%, #2A1A12 0 1.2px, #3B241A 1.2px 2.4px)',
        }}
      >
        {/* sheen makes the rotation visible */}
        <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_20deg,transparent_0_15%,rgba(255,255,255,.24)_22%,transparent_32%_62%,rgba(255,255,255,.15)_70%,transparent_80%)]" />
        <span className="absolute left-1/2 top-1/2 h-[8%] w-[8%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ivory" />
      </span>
      {/* tone arm swings onto the record while playing */}
      <motion.span
        className="absolute -right-[2px] -top-[4px] h-[58%] w-[3px] origin-top rounded-full bg-gradient-to-b from-gold-soft to-gold"
        animate={{ rotate: spinning ? 30 : 4 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
      >
        <span className="absolute -left-[2px] -top-[2px] h-[7px] w-[7px] rounded-full bg-gold-deep" />
      </motion.span>
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
      initial={{ opacity: 0, y: 24, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 1.2, type: 'spring', stiffness: 220, damping: 22 }}
      className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] right-4 z-50 sm:bottom-6 sm:right-6"
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="absolute bottom-[calc(100%+12px)] right-0 w-[min(92vw,360px)] origin-bottom-right overflow-hidden rounded-[24px] border border-gold/20 bg-white/95 shadow-lift backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 border-b border-gold/10 px-5 py-4">
              <Disc spinning={a.playing} size={52} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{a.track.title}</p>
                <p className="truncate font-mlsans text-[12.5px] text-saffron">{a.track.ml}</p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-full p-1.5 text-muted hover:bg-parchment" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="max-h-[46vh] overflow-y-auto p-2">
              {TRACKS.map((t, i) => {
                const current = t.id === a.track.id;
                return (
                  <motion.li key={t.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                    <button
                      onClick={() => (current ? a.toggle() : a.play(t.id))}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition',
                        current ? 'bg-[#FFF4E3]' : 'hover:bg-parchment/70',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition',
                          current ? 'bg-saffron text-white' : 'bg-parchment text-maroon',
                        )}
                      >
                        {current && a.playing ? (
                          <Bars active className="!h-3.5 [&>span]:!from-white [&>span]:!to-white" />
                        ) : (
                          <Play className="ml-0.5 h-3.5 w-3.5" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-ink">{t.title}</span>
                        <span className="block truncate font-mlsans text-[12px] text-muted">{t.ml}</span>
                      </span>
                    </button>
                  </motion.li>
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
              {a.track.artist} ·{' '}
              <a href={a.track.page} target="_blank" rel="noreferrer" className="underline decoration-gold/40 underline-offset-2">
                {a.track.license}
              </a>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-1 rounded-full border border-gold/20 bg-white/85 p-1.5 pr-2 shadow-soft backdrop-blur-xl">
        <button
          onClick={a.toggle}
          className="group relative rounded-full transition-transform hover:scale-105 active:scale-95"
          aria-label={a.playing ? 'Pause chant' : 'Play chant'}
        >
          {a.waiting && <span className="animate-ripple absolute inset-0 rounded-full border-2 border-saffron" />}
          <Disc spinning={a.playing} />
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center rounded-full bg-ink/35 text-white transition-opacity',
              a.playing ? 'opacity-0 group-hover:opacity-100' : 'opacity-100',
            )}
          >
            {a.playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
          </span>
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 items-center gap-2.5 rounded-full py-1 pl-2.5 pr-2 text-left hover:bg-parchment/60"
        >
          <span className="hidden min-w-0 max-w-[180px] min-[420px]:block">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={a.waiting ? 'wait' : a.track.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="block"
              >
                <span className="block truncate text-[12.5px] font-semibold leading-tight text-ink">
                  {a.waiting ? 'Tap anywhere for chants' : a.track.title}
                </span>
                <span className="block truncate font-mlsans text-[11px] leading-tight text-muted">{a.track.ml}</span>
              </motion.span>
            </AnimatePresence>
          </span>
          <Bars active={a.playing} />
        </button>
        <button
          onClick={a.next}
          className="hidden rounded-full p-2 text-muted transition hover:bg-parchment hover:text-maroon sm:block"
          aria-label="Next chant"
        >
          <SkipForward className="h-4 w-4" />
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-full p-2 text-muted transition hover:bg-parchment hover:text-maroon"
          aria-label="All chants"
        >
          <ListMusic className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
