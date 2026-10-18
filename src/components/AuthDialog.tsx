import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Lotus } from './ornaments';
import { TURNSTILE_SITE_KEY, Turnstile } from './Turnstile';
import { useAuth } from '../lib/auth';

type Step = 'email' | 'code' | 'profile';

// Must match Supabase → Authentication → Providers → Email → Email OTP Length.
const CODE_LENGTH = 8;

export function AuthDialog() {
  const auth = useAuth();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  // Pick the starting step once, when the dialog opens. (Reacting to every
  // session change made the name step flash up mid-sign-in.)
  useEffect(() => {
    if (!auth.dialogOpen) return;
    setError(null);
    if (auth.session && !auth.complete) {
      setStep('profile');
      setName(auth.profile?.full_name ?? '');
    } else {
      setStep('email');
      setDigits(Array(CODE_LENGTH).fill(''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.dialogOpen]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = (e?: FormEvent) => {
    e?.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (TURNSTILE_SITE_KEY && !captcha) return setError('Please complete the human check.');
    run(async () => {
      try {
        await auth.sendCode(email, captcha ?? undefined);
      } finally {
        // Turnstile tokens work once; get a fresh one for any retry.
        setCaptcha(null);
        setCaptchaKey((k) => k + 1);
      }
      setStep('code');
      setDigits(Array(CODE_LENGTH).fill(''));
      setResendIn(45);
      setTimeout(() => boxes.current[0]?.focus(), 50);
    });
  };

  const verify = (code: string) =>
    run(async () => {
      const p = await auth.verifyCode(email, code);
      if (p?.full_name?.trim()) auth.closeDialog(true);
      else {
        setName('');
        setStep('profile');
      }
    });

  const setDigit = (i: number, v: string) => {
    const clean = v.replace(/\D/g, '');
    if (clean.length > 1) {
      const next = clean.slice(0, CODE_LENGTH).split('');
      const filled = [...next, ...Array(CODE_LENGTH - next.length).fill('')];
      setDigits(filled);
      boxes.current[Math.min(next.length, CODE_LENGTH - 1)]?.focus();
      if (next.length === CODE_LENGTH) verify(next.join(''));
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < CODE_LENGTH - 1) boxes.current[i + 1]?.focus();
    if (next.every(Boolean)) verify(next.join(''));
  };

  const saveProfile = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError('Enter your name.');
    run(async () => {
      await auth.saveProfile({ full_name: name });
      auth.closeDialog(true);
    });
  };

  return (
    <AnimatePresence>
      {auth.dialogOpen && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/30 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && auth.closeDialog(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="relative w-full max-w-[420px] rounded-t-[28px] bg-ivory px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-6 shadow-lift sm:rounded-[28px] sm:p-8"
          >
            <div className="flex items-center justify-between">
              {step === 'code' ? (
                <button onClick={() => setStep('email')} className="-ml-2 rounded-full p-2 text-muted hover:bg-parchment" aria-label="Back">
                  <ArrowLeft className="h-4 w-4" />
                </button>
              ) : (
                <Lotus className="h-6 w-9" />
              )}
              <button onClick={() => auth.closeDialog(false)} className="-mr-2 rounded-full p-2 text-muted hover:bg-parchment" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            {step === 'email' && (
              <form onSubmit={sendCode} className="mt-4">
                <h2 id="auth-title" className="font-display text-[30px] leading-tight text-maroon">Sign in</h2>
                <p className="mt-1.5 text-[14.5px] text-muted">We’ll email you a sign-in code. No password needed.</p>
                <label className="mt-6 block text-[13px] font-semibold text-ink/80" htmlFor="auth-email">Email</label>
                <input
                  id="auth-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  className="field mt-2"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
                <Turnstile key={captchaKey} onToken={setCaptcha} />
                <button type="submit" disabled={busy} className="btn-primary mt-5 w-full">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />} Send code
                </button>
              </form>
            )}

            {step === 'code' && (
              <div className="mt-4">
                <h2 id="auth-title" className="font-display text-[30px] leading-tight text-maroon">Enter the code</h2>
                <p className="mt-1.5 text-[14.5px] text-muted">
                  Sent to <span className="font-semibold text-ink">{email}</span>. Check spam if it isn’t there in a minute.
                </p>
                <div className="mt-6 flex justify-between gap-1.5 sm:gap-2">
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => (boxes.current[i] = el)}
                      value={d}
                      onChange={(e) => setDigit(i, e.target.value)}
                      onKeyDown={(e) => e.key === 'Backspace' && !d && i > 0 && boxes.current[i - 1]?.focus()}
                      inputMode="numeric"
                      autoComplete={i === 0 ? 'one-time-code' : 'off'}
                      maxLength={CODE_LENGTH}
                      aria-label={`Digit ${i + 1}`}
                      className="h-12 w-full min-w-0 rounded-xl border border-gold/25 bg-white text-center font-display text-[22px] sm:h-14 sm:text-[24px] font-semibold text-maroon outline-none transition focus:border-saffron focus:ring-4 focus:ring-marigold/15"
                    />
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-between text-[13.5px]">
                  {busy ? (
                    <span className="flex items-center gap-2 text-muted">
                      <Loader2 className="h-4 w-4 animate-spin" /> Checking…
                    </span>
                  ) : (
                    <span />
                  )}
                  <button
                    onClick={() => (TURNSTILE_SITE_KEY ? setStep('email') : sendCode())}
                    disabled={resendIn > 0 || busy}
                    className="font-semibold text-saffron disabled:font-normal disabled:text-muted"
                  >
                    {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                  </button>
                </div>
              </div>
            )}

            {step === 'profile' && (
              <form onSubmit={saveProfile} className="mt-4">
                <h2 id="auth-title" className="font-display text-[30px] leading-tight text-maroon">Welcome</h2>
                <p className="mt-1.5 text-[14.5px] text-muted">What should we call you? Your name appears with your blessing.</p>
                <label className="mt-6 block text-[13px] font-semibold text-ink/80" htmlFor="auth-name">Your name</label>
                <input id="auth-name" autoFocus className="field mt-2" value={name} maxLength={80} autoComplete="name" onChange={(e) => setName(e.target.value)} />
                <button type="submit" disabled={busy} className="btn-primary mt-6 w-full">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />} Continue
                </button>
              </form>
            )}

            {error && (
              <p role="alert" className="mt-4 rounded-2xl bg-lotus-soft px-4 py-3 text-[13.5px] text-maroon">
                {error}
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
