import { AnimatePresence, motion } from 'framer-motion';
import { UNLOCK_AT } from '../lib/config';
import { useNow } from '../hooks/useNow';
import { cn } from '../lib/cn';

function split(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [
    { label: 'Days', ml: 'ദിവസം', v: Math.floor(s / 86400) },
    { label: 'Hours', ml: 'മണിക്കൂർ', v: Math.floor((s % 86400) / 3600) },
    { label: 'Minutes', ml: 'മിനിറ്റ്', v: Math.floor((s % 3600) / 60) },
    { label: 'Seconds', ml: 'സെക്കൻഡ്', v: s % 60 },
  ];
}

function Digit({ value }: { value: string }) {
  return (
    <span className="relative inline-flex h-[1.1em] w-[0.62em] justify-center overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: '-100%', opacity: 0, filter: 'blur(4px)' }}
          animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: '100%', opacity: 0, filter: 'blur(4px)' }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="absolute"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function Countdown({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  const now = useNow();
  const units = split(UNLOCK_AT.getTime() - now);
  return (
    <div className={cn('grid grid-cols-4', size === 'lg' ? 'gap-2 sm:gap-3' : 'gap-2')}>
      {units.map((u) => {
        const str = String(u.v).padStart(2, '0');
        return (
          <div
            key={u.label}
            className={cn(
              'flex flex-col items-center rounded-2xl border border-gold/15 bg-gradient-to-b from-white to-parchment/60',
              size === 'lg' ? 'px-2 py-3 sm:py-4' : 'px-1.5 py-2.5',
            )}
          >
            <span
              className={cn(
                'flex font-display font-semibold [font-variant-numeric:lining-nums_tabular-nums] leading-none text-maroon',
                size === 'lg' ? 'text-[34px] sm:text-[44px]' : 'text-[26px]',
              )}
            >
              {str.split('').map((d, i) => (
                <Digit key={i} value={d} />
              ))}
            </span>
            <span className="mt-1.5 text-[11px] font-semibold text-muted">{u.label}</span>
            {size === 'lg' && <span className="font-mlsans text-[10px] text-muted/70">{u.ml}</span>}
          </div>
        );
      })}
    </div>
  );
}
