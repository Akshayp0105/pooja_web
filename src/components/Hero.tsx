import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, KeyRound } from 'lucide-react';
import { useRef } from 'react';
import { Countdown } from './Countdown';
import { Diya, Mandala } from './ornaments';
import { ease } from './ui';
import { useNow } from '../hooks/useNow';
import { POOJA_VEPPU_AT, UNLOCK_AT, UNLOCK_LABEL } from '../lib/config';

function phaseLabel(now: number) {
  if (now >= UNLOCK_AT.getTime()) return { en: 'Vijayadashami · Pooja Eduppu', ml: 'വിജയദശമി' };
  if (now >= POOJA_VEPPU_AT.getTime()) return { en: 'Submissions are open · sealed till 21 Oct', ml: 'അടച്ചുപൂജ' };
  return { en: 'Pooja Veppu · this evening, 6:00 PM', ml: 'നവരാത്രി' };
}

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 1, delay, ease },
});

export function Hero() {
  const now = useNow(30_000);
  const unlocked = now >= UNLOCK_AT.getTime();
  const phase = phaseLabel(now);
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const artY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const artScale = useTransform(scrollYProgress, [0, 1], [1, 0.92]);

  return (
    <section
      id="top"
      ref={ref}
      className="gutter relative pb-10 pt-24 sm:pt-28 lg:pb-14 lg:pt-32"
    >
      <div className="mx-auto grid w-full max-w-wide items-center gap-8 sm:gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-[clamp(24px,4vw,96px)]">
        <div className="relative z-10 text-center lg:text-left">
          <motion.div {...fade(0.1)} className="chip">
            <span className="relative flex h-2 w-2">
              <span className="animate-ripple absolute inline-flex h-full w-full rounded-full bg-saffron" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-saffron" />
            </span>
            <span className="font-ml font-medium text-saffron">{phase.ml}</span>
            <span className="text-gold/50">·</span>
            {phase.en}
          </motion.div>

          <motion.p
            {...fade(0.2)}
            className="text-gilded mt-7 font-ml text-[clamp(32px,3vw,60px)] font-semibold leading-tight"
          >
            പൂജവെയ്പ്
          </motion.p>

          <motion.h1
            {...fade(0.3)}
            className="mt-2 font-display text-[clamp(44px,5.6vw,116px)] font-medium leading-[0.98] tracking-[-0.02em] text-maroon"
          >
            Lay your learning
            <br className="hidden sm:block" /> at the feet of{' '}
            <span className="italic text-saffron">Saraswati.</span>
          </motion.h1>

          <motion.p
            {...fade(0.45)}
            className="mx-auto mt-7 max-w-[36em] text-[clamp(16px,1.15vw,21px)] leading-relaxed text-muted lg:mx-0"
          >
            Submit your books, notes, music, art, video or voice. They rest sealed on the peedham and come back to you
            on Vijayadashami morning with a verse from the scriptures, in Malayalam and English.
          </motion.p>

          <motion.div
            {...fade(0.6)}
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start"
          >
            <a href={unlocked ? '#collect' : '#plans'} className="btn-primary group w-full sm:w-auto">
              {unlocked ? 'Open my belongings' : 'Submit from ₹10'}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            {!unlocked && (
              <a href="#collect" className="btn-ghost w-full sm:w-auto">
                <KeyRound className="h-4 w-4" /> My belongings
              </a>
            )}
          </motion.div>

          <motion.div {...fade(0.75)} className="card mx-auto mt-10 max-w-[34rem] p-5 text-left lg:mx-0">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold text-maroon">
                  {unlocked ? 'Belongings have returned' : 'Opens in'}
                </p>
                <p className="mt-0.5 text-[13px] text-muted">{UNLOCK_LABEL}</p>
              </div>
              <span className="font-ml text-[13px] text-saffron">പൂജയെടുപ്പ്</span>
            </div>
            <Countdown />
          </motion.div>
        </div>

        <motion.div
          style={{ y: artY, scale: artScale }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.6, ease }}
          className="relative order-first mx-auto aspect-square w-full max-w-[min(78vw,760px)] lg:order-none"
        >
          <div className="animate-breathe absolute inset-[6%] rounded-full bg-[radial-gradient(circle,rgba(255,214,140,.75)_0%,rgba(243,165,58,.25)_45%,transparent_70%)] blur-xl" />
          <Mandala className="animate-spin-slow absolute inset-0 text-gold/45" petals={28} />
          <Mandala className="animate-spin-slower-rev absolute inset-[13%] text-saffron/25" petals={18} />
          <div className="absolute inset-[22%] rounded-full border border-gold/25 bg-white/40 backdrop-blur-[2px]" />
          <img
            src="/saraswati.png"
            alt="Goddess Saraswati seated on a lotus, playing the veena"
            className="animate-float absolute inset-[15%] h-[70%] w-[70%] object-contain mix-blend-multiply [mask-image:radial-gradient(ellipse_50%_52%_at_50%_50%,#000_72%,transparent_100%)]"
          />
          <Diya className="absolute bottom-[2%] left-[8%] w-[13%]" />
          <Diya className="absolute bottom-[2%] right-[8%] w-[13%]" />
          <Diya className="absolute bottom-[-4%] left-1/2 w-[15%] -translate-x-1/2" />
        </motion.div>
      </div>
    </section>
  );
}
