import { Check, Copy, ExternalLink, Loader2, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { adminPayments, adminReview, adminStats, isAdmin, type AdminPayment, type AdminStats } from '../lib/api';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/cn';

type Tab = 'pending' | 'approved' | 'rejected';

export function Admin() {
  const auth = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('pending');
  const [rows, setRows] = useState<AdminPayment[] | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auth.ready) return;
    if (!auth.session) return setAllowed(false);
    isAdmin().then(setAllowed).catch(() => setAllowed(false));
  }, [auth.ready, auth.session]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([adminPayments(tab), adminStats()]);
      setRows(r);
      setStats(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  if (!auth.ready || allowed === null) {
    return (
      <Shell>
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-gold" />
      </Shell>
    );
  }
  if (!auth.session) {
    return (
      <Shell>
        <div className="card mx-auto max-w-md p-8 text-center">
          <h1 className="font-display text-[30px] text-maroon">Admin sign in</h1>
          <p className="mt-2 text-muted">Sign in with an admin email to review payments.</p>
          <button className="btn-primary mt-6" onClick={() => auth.requireAuth()}>
            Sign in
          </button>
        </div>
      </Shell>
    );
  }
  if (!allowed) {
    return (
      <Shell>
        <div className="card mx-auto max-w-md p-8 text-center">
          <h1 className="font-display text-[30px] text-maroon">Not an admin</h1>
          <p className="mt-2 text-muted">
            {auth.session.user.email} isn’t on the admin list. Add it to the <code>app_admins</code> table in Supabase.
          </p>
          <a href="#" className="btn-ghost mt-6">Back to site</a>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-ml text-[14px] text-saffron">നിർവ്വഹണം</p>
          <h1 className="font-display text-[clamp(34px,3vw,48px)] leading-tight text-maroon">Payments</h1>
        </div>
        <button onClick={load} className="btn-ghost !py-2.5" disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> Refresh
        </button>
      </div>

      {stats && (
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ['To review', stats.pending],
            ['Confirmed', stats.confirmed],
            ['Unpaid', stats.unpaid],
            ['Revenue', `₹${stats.revenue}`],
            ['Users', stats.users],
            ['Emails today', stats.emails_today],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-gold/15 bg-white/80 px-4 py-3">
              <dt className="text-[12px] text-muted">{k}</dt>
              <dd className="font-display text-[28px] font-semibold leading-tight text-maroon [font-variant-numeric:lining-nums]">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {stats && (
        <p className="mt-3 text-[13px] text-muted">
          Confirmed by plan:{' '}
          {Object.entries(stats.by_plan)
            .map(([k, v]) => `${k} ${v}`)
            .join(' · ')}
        </p>
      )}

      <div className="mt-8 flex gap-1 border-b border-gold/15">
        {(['pending', 'approved', 'rejected'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-[14px] font-semibold capitalize transition',
              tab === t ? 'border-saffron text-maroon' : 'border-transparent text-muted hover:text-maroon',
            )}
          >
            {t === 'pending' ? `To review${stats ? ` (${stats.pending})` : ''}` : t}
          </button>
        ))}
      </div>

      {error && <p className="mt-6 rounded-2xl bg-lotus-soft px-4 py-3 text-maroon">{error}</p>}
      {rows && rows.length === 0 && <p className="py-14 text-center text-muted">Nothing here.</p>}
      {rows && rows.length > 0 && (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <PaymentRow key={r.id} r={r} onDone={load} />
          ))}
        </ul>
      )}

      <p className="mt-10 text-[13px] leading-relaxed text-muted">
        To check a payment, open the Razorpay Dashboard → Transactions → Payments and search for the Payment ID. Approve
        only if the amount matches the plan.{' '}
        <a href="https://dashboard.razorpay.com/app/payments" target="_blank" rel="noreferrer" className="font-semibold text-saffron">
          Open Razorpay Dashboard
        </a>
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="gutter relative z-10 mx-auto min-h-screen max-w-wide pb-24 pt-28">{children}</main>;
}

function PaymentRow({ r, onDone }: { r: AdminPayment; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [copied, setCopied] = useState(false);
  const mismatch = r.amount_inr !== r.price_inr;

  const act = async (approve: boolean) => {
    if (!approve && !note.trim() && !confirm('Reject without a reason? The user will be asked to re-enter their Payment ID.')) return;
    setBusy(approve ? 'approve' : 'reject');
    try {
      await adminReview(r.id, approve, note);
      onDone();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(r.payment_id).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-parchment px-2 py-1 font-mono text-[14px] font-semibold text-maroon"
              title="Copy Payment ID"
            >
              {r.payment_id} {copied ? <Check className="h-3.5 w-3.5 text-leaf" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <a
              href={`https://dashboard.razorpay.com/app/payments/${r.payment_id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-saffron"
            >
              Check in Razorpay <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </p>
          <p className="mt-2 text-[15px] text-ink">
            <span className="font-semibold">{r.full_name || r.devotee_name || 'Unnamed'}</span> · {r.email}
            {r.phone && (
              <>
                {' · '}
                <a href={`tel:${r.phone}`} className="text-saffron">
                  {r.phone}
                </a>
              </>
            )}
          </p>
          <p className="mt-0.5 text-[13.5px] text-muted">
            {r.plan_name} · expected <span className={cn('font-semibold', mismatch ? 'text-maroon' : 'text-ink')}>₹{r.price_inr}</span> · {r.file_count} files ·{' '}
            {r.code} · {new Date(r.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
          {r.status !== 'pending' && (
            <p className="mt-1 text-[13px] text-muted">
              {r.status === 'approved' ? 'Approved' : 'Rejected'} by {r.reviewed_by}
              {r.reviewed_at && ` · ${new Date(r.reviewed_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`}
              {r.admin_note && ` · “${r.admin_note}”`}
            </p>
          )}
        </div>
        {r.status === 'pending' && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[280px]">
            <input className="field !py-2.5 text-[14px]" placeholder="Note to user (optional, for rejections)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => act(false)} disabled={!!busy} className="btn-ghost !py-2.5">
                {busy === 'reject' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Reject
              </button>
              <button onClick={() => act(true)} disabled={!!busy} className="btn-primary !py-2.5">
                {busy === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve
              </button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
