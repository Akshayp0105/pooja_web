import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, ChevronDown, Download, Gift as GiftIcon, Loader2, Lock } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Countdown } from './Countdown';
import { FileIcon } from './FileIcon';
import { Divider, Lotus, Mandala } from './ornaments';
import { PaymentPanel } from './PaymentPanel';
import { Reveal, SectionHeading, ease } from './ui';
import { useUnlocked } from '../hooks/useNow';
import {
  download,
  mySubmissions,
  openSubmission,
  signedUrls,
  type Gift,
  type MySubmission,
  type OpenedSubmission,
  type StoredFile,
} from '../lib/api';
import { useAuth } from '../lib/auth';
import { cn, fileKind, formatBytes } from '../lib/cn';
import { UNLOCK_LABEL } from '../lib/config';

const STATUS: Record<MySubmission['status'], { label: string; tone: string }> = {
  draft: { label: 'Draft', tone: 'bg-sand/60 text-muted' },
  awaiting_payment: { label: 'Payment pending', tone: 'bg-[#FFF1DC] text-saffron' },
  payment_review: { label: 'Checking payment', tone: 'bg-[#EEF2E8] text-leaf' },
  confirmed: { label: 'Confirmed', tone: 'bg-leaf text-white' },
  rejected: { label: 'Payment not verified', tone: 'bg-lotus-soft text-maroon' },
};

export function CollectSection() {
  const auth = useAuth();
  const unlocked = useUnlocked();
  const [list, setList] = useState<MySubmission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth.session) return setList(null);
    try {
      setList(await mySubmissions());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [auth.session]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh when someone comes back to the tab, e.g. after paying on Razorpay.
  useEffect(() => {
    const onFocus = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('pv:submitted', load);
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('pv:submitted', load);
    };
  }, [load]);

  return (
    <section id="collect" className="gutter section relative scroll-mt-24">
      <div className="mx-auto max-w-wide">
        <SectionHeading
          ml="പൂജയെടുപ്പ്"
          title="My belongings"
          sub={
            unlocked
              ? 'It is Vijayadashami. Open your belongings to receive your blessing.'
              : `Everything you’ve submitted, and where its payment stands. They open on ${UNLOCK_LABEL}.`
          }
        />

        <Reveal className="mt-10">
          {!auth.ready ? (
            <div className="card flex justify-center p-10">
              <Loader2 className="h-5 w-5 animate-spin text-gold" />
            </div>
          ) : !auth.session ? (
            <div className="card flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div>
                <h3 className="font-display text-[26px] leading-tight text-maroon">Sign in to see your belongings</h3>
                <p className="mt-1 text-[14.5px] text-muted">Use the email you submitted with. We’ll send a 6-digit code.</p>
              </div>
              <button type="button" onClick={() => auth.requireAuth()} className="btn-primary shrink-0">
                Sign in
              </button>
            </div>
          ) : error ? (
            <p className="card p-6 text-maroon">{error}</p>
          ) : !list ? (
            <div className="card flex justify-center p-10">
              <Loader2 className="h-5 w-5 animate-spin text-gold" />
            </div>
          ) : list.length === 0 ? (
            <div className="card flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div>
                <h3 className="font-display text-[26px] leading-tight text-maroon">Nothing submitted yet</h3>
                <p className="mt-1 text-[14.5px] text-muted">Your submissions will appear here with their payment status.</p>
              </div>
              {!unlocked && (
                <a href="#offer" className="btn-primary shrink-0">
                  Submit belongings
                </a>
              )}
            </div>
          ) : (
            <ul className="space-y-3">
              {list.map((s) => (
                <SubmissionRow key={s.code} s={s} open={opened === s.code} onToggle={() => setOpened(opened === s.code ? null : s.code)} onChanged={load} />
              ))}
            </ul>
          )}
        </Reveal>
      </div>
    </section>
  );
}

function SubmissionRow({ s, open, onToggle, onChanged }: { s: MySubmission; open: boolean; onToggle: () => void; onChanged: () => void }) {
  const status = STATUS[s.status];
  const needsPayment = s.status === 'awaiting_payment' || s.status === 'rejected';
  const canOpen = s.status === 'confirmed' && s.unlocked;
  const expandable = needsPayment || canOpen || s.status === 'confirmed';
  const date = new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  return (
    <li className={cn('card overflow-hidden transition-shadow', open && 'shadow-lift')}>
      <button
        type="button"
        onClick={expandable ? onToggle : undefined}
        className={cn('flex w-full flex-wrap items-center gap-x-5 gap-y-2 p-5 text-left sm:flex-nowrap sm:px-7', expandable ? 'cursor-pointer' : 'cursor-default')}
        aria-expanded={expandable ? open : undefined}
      >
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2.5">
            <span className="font-display text-[22px] leading-tight text-maroon">{s.name || 'Belongings'}</span>
            <span className="font-mono text-[12.5px] text-muted">{s.code}</span>
          </p>
          <p className="mt-0.5 text-[13.5px] text-muted">
            {s.plan.name} · ₹{s.plan.price_inr} · {s.file_count} {s.file_count === 1 ? 'item' : 'items'}
            {s.has_note ? ' + sankalpa' : ''} · {date}
          </p>
        </div>
        <span className={cn('rounded-full px-3 py-1 text-[12px] font-semibold', status.tone)}>{status.label}</span>
        {expandable && <ChevronDown className={cn('h-5 w-5 shrink-0 text-muted transition-transform', open && 'rotate-180')} />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease }}
            className="overflow-hidden"
          >
            <div className="border-t border-gold/10 p-5 sm:p-7">
              {needsPayment && (
                <PaymentPanel
                  code={s.code}
                  amount={s.plan.price_inr}
                  planName={s.plan.name}
                  rejectedNote={s.status === 'rejected' ? (s.payment?.note ?? null) : undefined}
                  onSubmitted={onChanged}
                />
              )}
              {s.status === 'confirmed' && !s.unlocked && <Resting />}
              {canOpen && <Opened code={s.code} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function Resting() {
  return (
    <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
      <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
        <Mandala className="animate-spin-slow absolute inset-0 text-gold/50" petals={20} />
        <Lock className="h-6 w-6 text-maroon" strokeWidth={1.8} />
      </div>
      <div className="flex-1">
        <p className="font-ml text-[14px] text-saffron">അടച്ചുപൂജ</p>
        <p className="font-display text-[24px] leading-tight text-maroon">Resting on the peedham</p>
        <p className="mt-1 text-[14px] text-muted">Payment confirmed. It opens on {UNLOCK_LABEL}.</p>
      </div>
      <div className="w-full max-w-[300px]">
        <Countdown size="sm" />
      </div>
    </div>
  );
}

const BURST = Array.from({ length: 20 }, (_, i) => {
  const a = (i / 20) * Math.PI * 2;
  const r = 130 + ((i * 37) % 80);
  return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.7, rot: (i * 47) % 360, c: ['#F3A53A', '#EFA9A4', '#F7C873', '#DD7420'][i % 4] };
});

function Opened({ code }: { code: string }) {
  const [data, setData] = useState<OpenedSubmission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [giftUrls, setGiftUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    openSubmission(code)
      .then(async (d) => {
        setData(d);
        if (d?.unlocked) {
          const [f, g] = await Promise.all([
            signedUrls('belongings', d.files.map((x) => x.path)),
            signedUrls('gifts', d.gifts.map((x) => x.path)),
          ]);
          setFileUrls(f);
          setGiftUrls(g);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [code]);

  if (error) return <p className="text-maroon">{error}</p>;
  if (!data) return <Loader2 className="mx-auto h-5 w-5 animate-spin text-gold" />;
  if (!data.unlocked) return <Resting />;

  const b = data.blessing;
  return (
    <div className="relative">
      <div className="pointer-events-none absolute left-1/2 top-20 z-20" aria-hidden>
        {BURST.map((p, i) => (
          <motion.span
            key={i}
            className="absolute block h-3 w-2.5 rounded-[60%_60%_50%_50%]"
            style={{ background: p.c }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
            animate={{ x: p.x, y: [0, p.y, p.y + 120], opacity: [1, 1, 0], scale: 1, rotate: p.rot + 360 }}
            transition={{ duration: 2.4, ease: 'easeOut', delay: 0.4 }}
          />
        ))}
      </div>

      {b && (
        <motion.div
          initial={{ opacity: 0, scaleY: 0.3 }}
          animate={{ opacity: 1, scaleY: 1 }}
          transition={{ duration: 1, ease }}
          style={{ transformOrigin: 'top' }}
          className="relative overflow-hidden rounded-[24px] border border-gold/30 bg-gradient-to-b from-[#FFFDF8] to-[#FBEBD2] px-6 py-10 text-center sm:px-14"
        >
          <Mandala className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 text-gold/20" />
          <p className="text-[12px] font-semibold text-gold-deep">{data.name ? `A blessing for ${data.name}` : 'Your blessing'} · അനുഗ്രഹം</p>
          <Lotus className="mx-auto mt-4 h-7 w-11" />
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 1, ease }}
            className="relative mx-auto mt-6 max-w-2xl font-ml text-[clamp(20px,1.8vw,26px)] font-medium leading-[1.75] text-maroon"
          >
            {b.ml}
          </motion.p>
          <Divider className="mx-auto my-6 max-w-xs" />
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 1, ease }}
            className="relative mx-auto max-w-2xl font-display text-[clamp(22px,2vw,30px)] italic leading-snug text-ink/85"
          >
            “{b.en}”
          </motion.p>
          <p className="relative mt-6 text-[13px] font-semibold text-gold-deep">
            {b.source} · <span className="font-mlsans font-medium">{b.source_ml}</span>
          </p>
        </motion.div>
      )}

      <p className="mt-5 flex items-start gap-3 text-[14px] text-muted">
        <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-saffron" />
        As tradition asks on Vijayadashami, read one page or play one note now. That is how the blessing begins.
      </p>

      {data.note && (
        <div className="mt-6">
          <p className="text-[12.5px] font-semibold text-muted">Your sankalpa · സങ്കല്പം</p>
          <p className="mt-2 whitespace-pre-wrap rounded-2xl bg-white/80 p-5 font-display text-[19px] leading-relaxed text-ink/85">{data.note}</p>
        </div>
      )}

      {data.files.length > 0 && (
        <div className="mt-7">
          <p className="text-[12.5px] font-semibold text-muted">Returned to you</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.files.map((f) => (
              <FileCard key={f.path} file={f} url={fileUrls[f.path]} />
            ))}
          </div>
        </div>
      )}

      {data.gifts.length > 0 && <Prasadam gifts={data.gifts} urls={giftUrls} />}
    </div>
  );
}

function FileCard({ file, url }: { file: StoredFile; url?: string }) {
  const kind = fileKind(file.type, file.name);
  const [busy, setBusy] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-gold/15 bg-white/85">
      {url && kind === 'image' && <img src={url} alt={file.name} className="max-h-60 w-full bg-parchment/50 object-contain" loading="lazy" />}
      {url && kind === 'video' && <video src={url} controls className="max-h-60 w-full bg-ink" preload="metadata" />}
      {url && kind === 'audio' && <audio src={url} controls className="w-full px-3 pt-3" preload="metadata" />}
      <div className="flex items-center gap-3 p-3">
        <FileIcon type={file.type} name={file.name} className="h-10 w-10" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-ink">{file.name}</p>
          <p className="text-[12px] text-muted">{formatBytes(file.size)}</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            setBusy(true);
            try {
              await download('belongings', file.path, file.name);
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-full border border-gold/20 p-2.5 text-maroon transition hover:border-saffron/50 hover:text-saffron"
          aria-label={`Download ${file.name}`}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function Prasadam({ gifts, urls }: { gifts: Gift[]; urls: Record<string, string> }) {
  return (
    <div className="mt-8 rounded-[24px] bg-[#FFF4E3] p-5 sm:p-7">
      <p className="flex items-center gap-2 font-display text-[24px] text-maroon">
        <GiftIcon className="h-5 w-5 text-saffron" /> Your Prasadam <span className="font-ml text-[16px] text-saffron">· പ്രസാദം</span>
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {gifts.map((g) => {
          const url = urls[g.path];
          const ext = g.path.split('.').pop();
          return (
            <div key={g.id} className="flex flex-col overflow-hidden rounded-2xl bg-white">
              {url && g.kind !== 'song' && <img src={url} alt={g.title} className="aspect-[4/5] w-full bg-parchment object-contain" loading="lazy" />}
              {url && g.kind === 'song' && (
                <div className="flex aspect-[4/5] flex-col items-center justify-center gap-5 bg-gradient-to-b from-parchment to-white p-5">
                  <Lotus className="h-12 w-20" />
                  <audio src={url} controls className="w-full" preload="none" />
                </div>
              )}
              <div className="flex flex-1 items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{g.title}</p>
                  <p className="font-mlsans text-[12.5px] text-saffron">{g.title_ml}</p>
                  <p className="mt-1 text-[13px] leading-snug text-muted">{g.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => download('gifts', g.path, `${g.title}.${ext}`)}
                  className="rounded-full border border-gold/20 p-2.5 text-maroon transition hover:border-saffron/50 hover:text-saffron"
                  aria-label={`Download ${g.title}`}
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

