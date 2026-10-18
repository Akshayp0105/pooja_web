import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export const ease = [0.22, 1, 0.36, 1] as const;

export function Reveal({
  children,
  delay = 0,
  className,
  y = 24,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.9, delay, ease }}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeading({
  ml,
  eyebrow,
  title,
  sub,
}: {
  ml: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <Reveal className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-end md:gap-12">
      <div>
        {eyebrow && <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-gold-deep/80">{eyebrow}</p>}
        <p className="font-ml text-[15px] text-saffron">{ml}</p>
        <h2 className="mt-1 font-display text-[clamp(34px,3.4vw,60px)] font-medium leading-[1.04] tracking-[-0.01em] text-maroon">
          {title}
        </h2>
      </div>
      {sub && <p className="max-w-[40em] text-[clamp(15px,1vw,18px)] leading-relaxed text-muted md:pb-1.5">{sub}</p>}
    </Reveal>
  );
}
