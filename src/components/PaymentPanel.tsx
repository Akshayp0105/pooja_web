import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { RAZORPAY_LINK } from '../lib/config';
import { submitPayment } from '../lib/api';

async function copyText(t: string) {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    return false;
  }
}

/** Pay on razorpay.me, then paste the Payment ID for the team to verify. */
export function PaymentPanel({
  code,
  amount,
  planName,
  rejectedNote,
  onSubmitted,
}: {
  code: string;
  amount: number;
  planName: string;
  rejectedNote?: string | null;
  onSubmitted: () => void;
}) {
  const [paymentId, setPaymentId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await submitPayment(code, paymentId);
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {rejectedNote !== undefined && (
        <p className="mb-5 rounded-2xl bg-lotus-soft px-4 py-3 text-[14px] text-maroon">
          We couldn’t verify the last Payment ID{rejectedNote ? `: ${rejectedNote}` : '.'} Please check it and try again.
        </p>
      )}
      <ol className="space-y-5">
        <li className="flex gap-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-maroon text-[13px] font-bold text-white">1</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">
              Pay <span className="text-saffron">₹{amount}</span> for {planName}
            </p>
            <p className="mt-1 text-[14px] leading-relaxed text-muted">
              Enter exactly ₹{amount} and use the same email you signed in with, so we can match the payment to you. If it asks
              for a note, add your code{' '}
              <button
                type="button"
                onClick={async () => setCopied(await copyText(code))}
                className="inline-flex items-center gap-1 rounded-md bg-parchment px-1.5 py-0.5 font-mono text-[13px] font-semibold text-maroon"
              >
                {code}
                {copied ? <Check className="h-3 w-3 text-leaf" /> : <Copy className="h-3 w-3" />}
              </button>
            </p>
            <a href={RAZORPAY_LINK} target="_blank" rel="noopener noreferrer" className="btn-primary mt-3 !py-3">
              Pay ₹{amount} on Razorpay <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </li>
        <li className="flex gap-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-maroon text-[13px] font-bold text-white">2</span>
          <form onSubmit={submit} className="min-w-0 flex-1">
            <label htmlFor={`pid-${code}`} className="font-semibold text-ink">
              Paste your Payment ID
            </label>
            <p className="mt-1 text-[14px] leading-relaxed text-muted">
              It’s on the Razorpay success screen and in the receipt email, and looks like <span className="font-mono text-ink">pay_Nx8Fq2kLm3PqRs</span>.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                id={`pid-${code}`}
                className="field font-mono"
                value={paymentId}
                onChange={(e) => setPaymentId(e.target.value.trim())}
                placeholder="pay_XXXXXXXXXXXXXX"
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" disabled={busy || paymentId.length < 18} className="btn-primary shrink-0 !py-3">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Submit
              </button>
            </div>
            {error && (
              <p role="alert" className="mt-3 rounded-2xl bg-lotus-soft px-4 py-3 text-[13.5px] text-maroon">
                {error}
              </p>
            )}
          </form>
        </li>
      </ol>
    </div>
  );
}
