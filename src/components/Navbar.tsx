import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { LogOut, Shield, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Lotus } from './ornaments';
import { useUnlocked } from '../hooks/useNow';
import { isAdmin } from '../lib/api';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/cn';

const LINKS = [
  { href: '#plans', label: 'Plans' },
  { href: '#offer', label: 'Submit' },
  { href: '#collect', label: 'My belongings' },
  { href: '#mantras', label: 'Slokams' },
];

/** Which section is in the middle of the screen, for the nav highlight. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-45% 0px -50% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return active;
}

export function Navbar({ admin = false }: { admin?: boolean }) {
  const active = useActiveSection(['top', 'plans', 'offer', 'collect', 'ritual', 'mantras']);
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const unlocked = useUnlocked();
  useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 24));

  return (
    <header className="gutter fixed inset-x-0 top-3 z-50 sm:top-5">
      <nav
        className={cn(
          'mx-auto flex max-w-wide items-center justify-between gap-3 rounded-full border py-2 pl-4 pr-2 transition-all duration-500',
          scrolled || admin ? 'border-gold/20 bg-white/80 shadow-soft backdrop-blur-xl' : 'border-transparent',
        )}
      >
        <a href={admin ? '#' : '#top'} className="flex shrink-0 items-center gap-2.5">
          <Lotus className="h-6 w-9" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-[19px] font-semibold text-maroon">Pooja Veppu</span>
            <span className="mt-1 font-ml text-[10.5px] leading-tight text-gold-deep">പൂജവെയ്പ് · 2026</span>
          </span>
        </a>
        {!admin && (
          <div className="hidden items-center lg:flex">
            {LINKS.map((l) => {
              const on = active === l.href.slice(1);
              return (
                <a
                  key={l.href}
                  href={l.href}
                  className={cn('relative rounded-full px-4 py-2 text-[14px] font-medium transition-colors', on ? 'text-maroon' : 'text-ink/65 hover:text-maroon')}
                >
                  {on && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-full bg-[#FFF1DC]"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className="relative">{l.label}</span>
                </a>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Account />
          {!admin && (
            <a href={unlocked ? '#collect' : '#plans'} className="btn-primary hidden !px-5 !py-2.5 !text-[14px] sm:inline-flex">
              {unlocked ? 'Open belongings' : 'Submit belongings'}
            </a>
          )}
        </div>
      </nav>
    </header>
  );
}

function Account() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [admin, setAdmin] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (auth.session) isAdmin().then(setAdmin).catch(() => setAdmin(false));
    else setAdmin(false);
  }, [auth.session]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  if (!auth.ready) return null;
  if (!auth.session) {
    return (
      <button onClick={() => auth.requireAuth()} className="rounded-full px-4 py-2.5 text-[14px] font-semibold text-maroon transition hover:bg-gold/10">
        Sign in
      </button>
    );
  }

  const label = auth.profile?.full_name || auth.session.user.email || '';
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-maroon font-display text-[18px] font-semibold text-white"
        aria-label="Account"
        aria-expanded={open}
      >
        {label.charAt(0).toUpperCase() || <User className="h-4 w-4" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-[calc(100%+10px)] w-64 overflow-hidden rounded-2xl border border-gold/20 bg-white p-1.5 shadow-lift"
          >
            <div className="px-3 py-2.5">
              <p className="truncate font-semibold text-ink">{auth.profile?.full_name || 'Signed in'}</p>
              <p className="truncate text-[12.5px] text-muted">{auth.session.user.email}</p>
            </div>
            <a href="#collect" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] text-ink hover:bg-parchment">
              <User className="h-4 w-4 text-muted" /> My belongings
            </a>
            {admin && (
              <a href="#/admin" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] text-ink hover:bg-parchment">
                <Shield className="h-4 w-4 text-muted" /> Admin · payments
              </a>
            )}
            <button
              onClick={() => {
                setOpen(false);
                auth.signOut();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[14px] text-ink hover:bg-parchment"
            >
              <LogOut className="h-4 w-4 text-muted" /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
