import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Check, Mic, PenLine, UploadCloud, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { FileIcon } from './FileIcon';
import { Diya } from './ornaments';
import { PaymentPanel } from './PaymentPanel';
import { Reveal, SectionHeading, ease } from './ui';
import { VoiceRecorder } from './VoiceRecorder';
import { useUnlocked } from '../hooks/useNow';
import { createAndSeal, type UploadProgress } from '../lib/api';
import { useAuth } from '../lib/auth';
import { cn, fileKind, formatBytes } from '../lib/cn';
import { MAX_FILES, MAX_FILE_BYTES, UNLOCK_LABEL } from '../lib/config';
import { usePlans } from '../lib/plans';

type Item = { id: string; file: File; preview?: string };
type Stage = { kind: 'compose' } | { kind: 'pay'; code: string } | { kind: 'done'; code: string };

export function OfferSection() {
  const unlocked = useUnlocked();
  return (
    <section id="offer" className="gutter section relative scroll-mt-24">
      <div className="mx-auto max-w-wide">
        <SectionHeading
          ml="സമർപ്പണം"
          title="Submit your belongings"
          sub={`Books, notes, music, art, video or your voice. Submit anytime; everything stays sealed until ${UNLOCK_LABEL}.`}
        />
        <Reveal className="mt-10">{unlocked ? <Closed /> : <SubmitFlow />}</Reveal>
      </div>
    </section>
  );
}

function Closed() {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <Diya className="w-16" />
      <h3 className="mt-6 font-display text-[32px] text-maroon">Submissions are closed for this year</h3>
      <p className="mt-2 max-w-md text-muted">It is Vijayadashami. Open what you submitted from My belongings.</p>
      <a href="#collect" className="btn-primary mt-7">Go to My belongings</a>
    </div>
  );
}

function SubmitFlow() {
  const { plans, selected, select } = usePlans();
  const auth = useAuth();
  const [stage, setStage] = useState<Stage>({ kind: 'compose' });

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)] lg:gap-6">
      <div className="card overflow-hidden p-5 sm:p-8">
        {stage.kind === 'compose' && (
          <Compose
            onSealed={(code) => {
              window.dispatchEvent(new Event('pv:submitted'));
              setStage({ kind: 'pay', code });
            }}
          />
        )}
        {stage.kind === 'pay' && (
          <div>
            <p className="font-ml text-[14px] text-saffron">മുദ്രവെച്ചു · Sealed</p>
            <h3 className="mt-1 font-display text-[30px] leading-tight text-maroon">Your belongings are on the peedham</h3>
            <p className="mt-2 text-[14.5px] text-muted">
              Reference code <span className="font-mono font-semibold text-maroon">{stage.code}</span>. One last step: payment.
            </p>
            <div className="hairline my-6" />
            <PaymentPanel
              code={stage.code}
              amount={selected.price_inr}
              planName={selected.name}
              onSubmitted={() => {
                window.dispatchEvent(new Event('pv:submitted'));
                setStage({ kind: 'done', code: stage.code });
              }}
            />
            <p className="mt-6 text-[13px] text-muted">
              You can also pay later from <a href="#collect" className="font-semibold text-saffron">My belongings</a>.
            </p>
          </div>
        )}
        {stage.kind === 'done' && (
          <div className="py-6 text-center">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 16 }}
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-leaf text-white"
            >
              <Check className="h-8 w-8" strokeWidth={2.5} />
            </motion.div>
            <h3 className="mt-6 font-display text-[30px] leading-tight text-maroon">Payment received for checking</h3>
            <p className="mx-auto mt-2 max-w-md text-[14.5px] text-muted">
              We’ll confirm it shortly, usually within a few hours. Your belongings open on {UNLOCK_LABEL}.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
              <a href="#collect" className="btn-primary">View My belongings</a>
              <button type="button" className="btn-ghost" onClick={() => setStage({ kind: 'compose' })}>
                Submit something else
              </button>
            </div>
          </div>
        )}
      </div>

      <aside className="card self-start p-6 sm:p-7 lg:sticky lg:top-28">
        <p className="text-[12px] font-semibold text-muted">Your plan</p>
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-parchment/70 p-1">
          {plans.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={stage.kind !== 'compose'}
              onClick={() => select(p.id)}
              className={cn(
                'rounded-xl px-2 py-2.5 text-center transition',
                p.id === selected.id ? 'bg-white text-maroon shadow-sm' : 'text-muted hover:text-maroon',
                stage.kind !== 'compose' && 'cursor-default',
              )}
            >
              <span className="block text-[15px] font-bold">₹{p.price_inr}</span>
              <span className="block truncate text-[11.5px]">{p.name}</span>
            </button>
          ))}
        </div>
        <h3 className="mt-5 font-display text-[24px] leading-tight text-maroon">
          {selected.name} <span className="font-ml text-[16px] text-saffron">· {selected.name_ml}</span>
        </h3>
        <ul className="mt-3 space-y-2">
          {selected.features.map((f) => (
            <li key={f} className="flex gap-2 text-[14px] leading-snug text-ink/80">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-leaf" strokeWidth={2.4} />
              {f}
            </li>
          ))}
        </ul>
        <div className="hairline my-5" />
        {auth.session ? (
          <p className="text-[13px] text-muted">
            Signed in as <span className="font-semibold text-ink">{auth.profile?.full_name || auth.session.user.email}</span>
          </p>
        ) : (
          <p className="text-[13px] text-muted">You’ll sign in with your email before sealing, so your belongings stay yours.</p>
        )}
      </aside>
    </div>
  );
}

function Compose({ onSealed }: { onSealed: (code: string) => void }) {
  const auth = useAuth();
  const { selected } = usePlans();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [recording, setRecording] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => () => itemsRef.current.forEach((i) => i.preview && URL.revokeObjectURL(i.preview)), []);
  useEffect(() => {
    if (!name && auth.profile?.full_name) setName(auth.profile.full_name);
  }, [auth.profile?.full_name, name]);

  const addFiles = useCallback((list: FileList | File[]) => {
    const incoming = Array.from(list);
    const tooBig = incoming.filter((f) => f.size > MAX_FILE_BYTES);
    const current = itemsRef.current;
    const seen = new Set(current.map((p) => `${p.file.name}:${p.file.size}:${p.file.lastModified}`));
    const fresh = incoming.filter((f) => f.size > 0 && f.size <= MAX_FILE_BYTES && !seen.has(`${f.name}:${f.size}:${f.lastModified}`));
    const room = MAX_FILES - current.length;
    const msgs: string[] = [];
    if (tooBig.length) msgs.push(`${tooBig.map((f) => f.name).join(', ')} ${tooBig.length > 1 ? 'are' : 'is'} over 50 MB.`);
    if (fresh.length > room) msgs.push(`You can add up to ${MAX_FILES} items.`);
    setError(msgs.length ? msgs.join(' ') : null);
    const added = fresh.slice(0, Math.max(0, room)).map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: ['image', 'audio'].includes(fileKind(file.type)) ? URL.createObjectURL(file) : undefined,
    }));
    setItems([...current, ...added]);
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (busy) return;
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) addFiles(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addFiles, busy]);

  const remove = (id: string) => {
    const it = items.find((p) => p.id === id);
    if (it?.preview) URL.revokeObjectURL(it.preview);
    setItems(items.filter((p) => p.id !== id));
  };

  const totalBytes = items.reduce((s, i) => s + i.file.size, 0);
  const canSubmit = (items.length > 0 || note.trim().length > 0) && !busy && !recording;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    if (!(await auth.requireAuth())) return;
    setBusy(true);
    setProgress({ index: 0, count: items.length, current: '', doneBytes: 0, totalBytes });
    try {
      const code = await createAndSeal({ plan: selected.id, name, note, files: items.map((i) => i.file) }, setProgress);
      items.forEach((i) => i.preview && URL.revokeObjectURL(i.preview));
      onSealed(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const pct = progress && progress.totalBytes ? Math.round((progress.doneBytes / progress.totalBytes) * 100) : 0;

  return (
    <form onSubmit={submit} className="relative">
      <label className="block">
        <span className="mb-2 block text-[13px] font-semibold text-ink/80">
          Whose belongings? <span className="font-normal text-muted">(shown with your blessing)</span>
        </span>
        <input className="field" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Your name, or your child’s" />
      </label>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input.current?.click())}
        role="button"
        tabIndex={0}
        aria-label="Add files"
        className={cn(
          'mt-5 flex cursor-pointer items-center gap-4 rounded-[20px] border-[1.5px] border-dashed px-5 py-6 transition-colors duration-200 sm:gap-5 sm:px-6',
          drag ? 'border-saffron bg-[#FFF4E3]' : 'border-gold/35 bg-white/70 hover:border-saffron/60 hover:bg-white',
        )}
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFF1DC] text-saffron">
          <UploadCloud className="h-6 w-6" strokeWidth={1.7} />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-maroon">{drag ? 'Drop to add' : 'Add files'}</span>
          <span className="block text-[13.5px] text-muted">Drag here or tap to browse. Any format, up to 50 MB each.</span>
        </span>
        <input
          ref={input}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setRecording(true)}
          disabled={recording}
          className={cn('pill-btn', recording && 'pill-btn-on')}
        >
          <Mic className="h-4 w-4" /> Record voice
        </button>
        <button type="button" onClick={() => setShowNote((v) => !v)} className={cn('pill-btn', showNote && 'pill-btn-on')}>
          <PenLine className="h-4 w-4" /> Write a sankalpa
        </button>
      </div>

      <AnimatePresence initial={false}>
        {recording && (
          <motion.div key="rec" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-3">
              <VoiceRecorder
                onCancel={() => setRecording(false)}
                onDone={(f) => {
                  addFiles([f]);
                  setRecording(false);
                }}
              />
            </div>
          </motion.div>
        )}
        {showNote && (
          <motion.div key="note" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-3">
              <textarea
                className="field min-h-[110px] resize-y leading-relaxed"
                value={note}
                maxLength={4000}
                onChange={(e) => setNote(e.target.value)}
                placeholder="A prayer, or what you hope to learn this year (സങ്കല്പം)"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {items.length > 0 && (
        <div className="mt-5">
          <p className="flex justify-between text-[12.5px] font-semibold text-muted">
            <span>
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </span>
            <span className="tabular-nums">{formatBytes(totalBytes)}</span>
          </p>
          <ul className="mt-2 divide-y divide-gold/10 rounded-2xl border border-gold/15 bg-white/80">
            <AnimatePresence initial={false}>
              {items.map((it) => (
                <motion.li
                  key={it.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease }}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  {fileKind(it.file.type) === 'image' && it.preview ? (
                    <img src={it.preview} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <FileIcon type={it.file.type} name={it.file.name} className="h-10 w-10" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink">{it.file.name}</p>
                    <p className="text-[12px] text-muted">{formatBytes(it.file.size)}</p>
                  </div>
                  {fileKind(it.file.type) === 'audio' && it.preview && <audio src={it.preview} controls className="hidden h-8 w-44 sm:block" />}
                  <button
                    type="button"
                    onClick={() => remove(it.id)}
                    disabled={busy}
                    className="rounded-full p-2 text-muted transition hover:bg-lotus-soft hover:text-maroon"
                    aria-label={`Remove ${it.file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}

      {error && (
        <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-2xl bg-lotus-soft px-4 py-3 text-[14px] text-maroon">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <button type="submit" disabled={!canSubmit} className="btn-primary mt-6 w-full !py-4 !text-[16px]">
        Seal and continue to payment · ₹{selected.price_inr}
      </button>

      <AnimatePresence>
        {busy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute -inset-5 z-10 flex flex-col items-center justify-center bg-ivory/95 px-8 text-center backdrop-blur-sm sm:-inset-8"
            aria-live="polite"
          >
            <Diya className="w-16" />
            <p className="mt-6 font-display text-[26px] text-maroon">Placing on the peedham</p>
            <p className="mt-1 h-5 max-w-xs truncate text-[13.5px] text-muted">
              {progress && progress.count > 0 && progress.index < progress.count
                ? `${progress.index + 1} of ${progress.count} · ${progress.current}`
                : 'Sealing…'}
            </p>
            <div className="mt-5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-gold/15">
              <motion.div className="h-full rounded-full bg-saffron" animate={{ width: `${Math.max(6, pct)}%` }} transition={{ ease }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
