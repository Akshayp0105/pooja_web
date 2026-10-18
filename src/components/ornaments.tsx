import { useId } from 'react';
import { cn } from '../lib/cn';

export function Lotus({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 64 40" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F7B9B1" />
          <stop offset="1" stopColor="#E58F88" />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F6B154" />
          <stop offset="1" stopColor="#DD7420" />
        </linearGradient>
      </defs>
      <path d="M30 36.5C19 37 9 33 3 25C11 23 19 25 25 31Z" fill={`url(#${id}-a)`} opacity=".65" />
      <path d="M34 36.5C45 37 55 33 61 25C53 23 45 25 39 31Z" fill={`url(#${id}-a)`} opacity=".65" />
      <path d="M32 36C24 35 17 30 14 20C21 20 27 24 30 30Z" fill={`url(#${id}-a)`} />
      <path d="M32 36C40 35 47 30 50 20C43 20 37 24 34 30Z" fill={`url(#${id}-a)`} />
      <path d="M32 3C38 11 40 18 40 24C40 30 36 34 32 36C28 34 24 30 24 24C24 18 26 11 32 3Z" fill={`url(#${id}-b)`} />
    </svg>
  );
}

export function Mandala({ petals = 24, className }: { petals?: number; className?: string }) {
  const step = 360 / petals;
  return (
    <svg viewBox="-100 -100 200 200" className={className} fill="none" stroke="currentColor" aria-hidden>
      <circle r="98" strokeWidth=".35" />
      <circle r="93" strokeWidth=".4" strokeDasharray="0.6 2.6" strokeLinecap="round" />
      {Array.from({ length: petals }, (_, i) => (
        <g key={i} transform={`rotate(${i * step})`}>
          <path d="M0 -89C9 -77 9 -64 0 -54C-9 -64 -9 -77 0 -89Z" strokeWidth=".5" />
          <path d="M0 -82C4 -75 4 -67 0 -61C-4 -67 -4 -75 0 -82Z" strokeWidth=".35" />
          <circle cy="-95.5" r=".9" fill="currentColor" stroke="none" />
        </g>
      ))}
      {Array.from({ length: petals }, (_, i) => (
        <path
          key={i}
          transform={`rotate(${i * step + step / 2})`}
          d="M0 -60C5 -55 5 -50 0 -46C-5 -50 -5 -55 0 -60Z"
          strokeWidth=".35"
        />
      ))}
      <circle r="50" strokeWidth=".35" />
      <circle r="46" strokeWidth=".3" strokeDasharray="1 2" />
    </svg>
  );
}

export function Diya({ className }: { className?: string }) {
  const id = useId();
  return (
    <div className={className} aria-hidden>
      <div className="relative">
      <div className="animate-glow absolute left-1/2 top-[-30%] h-[90%] w-[90%] rounded-full bg-marigold/50 blur-2xl" />
      {/* The flame is its own HTML layer so the flicker runs on the GPU;
          animating an SVG path re-lays out the page every frame. */}
      <span className="flame absolute left-[37.5%] top-[3.1%] z-10 block h-[51.6%] w-[25%]">
        <svg viewBox="30 2 20 33" className="block h-full w-full overflow-visible">
          <defs>
            <radialGradient id={`${id}-f`} cx="50%" cy="75%" r="70%">
              <stop offset="0" stopColor="#FFFBEA" />
              <stop offset=".35" stopColor="#FFD36B" />
              <stop offset=".75" stopColor="#F59A2A" />
              <stop offset="1" stopColor="#E0641C" stopOpacity=".2" />
            </radialGradient>
          </defs>
          <path d="M40 2C46.5 12 50 19 50 25.5C50 31 45.5 35 40 35C34.5 35 30 31 30 25.5C30 19 33.5 12 40 2Z" fill={`url(#${id}-f)`} />
        </svg>
      </span>
      <svg viewBox="0 0 80 64" className="relative block w-full overflow-visible">
        <defs>
          <linearGradient id={`${id}-c`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#D88A4E" />
            <stop offset="1" stopColor="#9A4722" />
          </linearGradient>
        </defs>
        <path d="M6 34C10 50 24 58 40 58C56 58 70 50 74 34C62 38 52 39.5 40 39.5C28 39.5 18 38 6 34Z" fill={`url(#${id}-c)`} />
        <ellipse cx="40" cy="35.5" rx="34" ry="4" fill="#EDB27A" />
        <path d="M14 44C22 50 30 52 40 52C50 52 58 50 66 44" stroke="#F2C08E" strokeOpacity=".5" strokeWidth="1" fill="none" />
        <path d="M30 57.5H50L53 62H27Z" fill="#8A3E1D" />
      </svg>
      </div>
    </div>
  );
}

const PETALS = Array.from({ length: 16 }, (_, i) => ({
  left: (i * 61 + 7) % 100,
  delay: -((i * 2.3) % 22),
  duration: 16 + ((i * 37) % 12),
  size: 9 + ((i * 13) % 9),
  sway: ((i % 2 ? 1 : -1) * (40 + ((i * 17) % 60))) + 'px',
  color: ['#F3A53A', '#F7C873', '#EFA9A4', '#FFF3E0'][i % 4],
}));

export function Petals() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {PETALS.map((p, i) => (
        <span
          key={i}
          className="petal"
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.size * 1.3,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              '--sway': p.sway,
            } as React.CSSProperties
          }
        >
          <svg viewBox="0 0 10 13" className="h-full w-full drop-shadow-sm">
            <path d="M5 0C8.5 3.5 10 6.5 10 8.7C10 11.1 7.8 13 5 13C2.2 13 0 11.1 0 8.7C0 6.5 1.5 3.5 5 0Z" fill={p.color} />
          </svg>
        </span>
      ))}
    </div>
  );
}

export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-ivory">
      <div className="absolute left-1/2 top-[-260px] h-[820px] w-[1200px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(243,165,58,.24),transparent)]" />
      <div className="absolute bottom-[-260px] left-[-220px] h-[640px] w-[640px] rounded-full bg-[radial-gradient(closest-side,rgba(229,143,136,.18),transparent)]" />
      <div className="absolute right-[-200px] top-[40%] h-[560px] w-[560px] rounded-full bg-[radial-gradient(closest-side,rgba(230,201,138,.22),transparent)]" />
      <div className="bg-kolam absolute inset-0" />
      <div className="grain absolute inset-0 opacity-[.05] mix-blend-multiply" />
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-4', className)} aria-hidden>
      <div className="hairline flex-1" />
      <Lotus className="h-4 w-7 opacity-80" />
      <div className="hairline flex-1" />
    </div>
  );
}
