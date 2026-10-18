import { cached, invalidate } from './cache';
import { supabase } from './supabase';

export type Plan = {
  id: 'samarppanam' | 'prasadam' | 'anugraham';
  name: string;
  name_ml: string;
  price_inr: number;
  summary: string;
  features: string[];
  includes_gift: boolean;
  includes_daily: boolean;
};

export type SubmissionStatus = 'draft' | 'awaiting_payment' | 'payment_review' | 'confirmed' | 'rejected';

export type MySubmission = {
  code: string;
  status: SubmissionStatus;
  created_at: string;
  name: string | null;
  plan: Pick<Plan, 'id' | 'name' | 'name_ml' | 'price_inr' | 'includes_gift' | 'includes_daily'>;
  file_count: number;
  has_note: boolean;
  payment: { status: 'pending' | 'approved' | 'rejected'; payment_id: string; note: string | null } | null;
  unlocked: boolean;
};

export type StoredFile = { path: string; name: string; size: number; type: string };

export type Gift = {
  id: string;
  kind: 'photo' | 'slokam' | 'song';
  title: string;
  title_ml: string;
  description: string;
  path: string;
};

export type OpenedSubmission =
  | { unlocked: false; code: string; status: SubmissionStatus; unlock_at: string }
  | {
      unlocked: true;
      code: string;
      name: string | null;
      note: string | null;
      created_at: string;
      plan: Pick<Plan, 'id' | 'name' | 'name_ml'>;
      files: StoredFile[];
      blessing: { id: number; en: string; ml: string; source: string; source_ml: string; total: number } | null;
      gifts: Gift[];
    };

export type AdminPayment = {
  id: string;
  payment_id: string;
  amount_inr: number;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  code: string;
  devotee_name: string | null;
  plan_name: string;
  price_inr: number;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  file_count: number;
};

export type AdminStats = {
  pending: number;
  confirmed: number;
  unpaid: number;
  revenue: number;
  users: number;
  by_plan: Record<string, number>;
  emails_today: number;
};

export type UploadProgress = { index: number; count: number; current: string; doneBytes: number; totalBytes: number };

const MESSAGES: [RegExp, string][] = [
  [/RATE_LIMITED/, 'You’re going a little fast. Please wait a minute and try again.'],
  [/SUBMISSIONS_CLOSED/, 'Submissions have closed for this year. It is time for Pooja Eduppu.'],
  [/NOT_SIGNED_IN|JWT|not authenticated/i, 'Please sign in again to continue.'],
  [/INVALID_PAYMENT_ID/, 'That doesn’t look like a Razorpay Payment ID. It starts with pay_ followed by 14 letters and numbers.'],
  [/PAYMENT_ID_USED/, 'This Payment ID has already been used for another submission.'],
  [/TOO_MANY_UNPAID/, 'You have 5 submissions waiting for payment. Pay for those in My belongings before starting another.'],
  [/TOO_MANY_ATTEMPTS/, 'Too many Payment IDs entered in the last hour. Please wait a while and try again.'],
  [/CONTACT_SUPPORT/, 'This payment could not be verified after several tries. Please contact the Pooja Veppu team.'],
  [/TOO_LARGE/, 'All files together must be under 500 MB.'],
  [/captcha/i, 'Please complete the human check and try again.'],
  [/TOO_MANY_SUBMISSIONS/, 'You have started many submissions in the last hour. Please try again a little later.'],
  [/EMPTY_SUBMISSION/, 'Add at least one file or a sankalpa.'],
  [/FILE_MISSING|INVALID_FILES/, 'Some files did not finish uploading. Please try again.'],
  [/NOT_ADMIN/, 'This page is only for the Pooja Veppu team.'],
  [/Could not find the function|does not exist|Bucket not found/i, 'The site’s database isn’t set up yet. Run supabase/01_schema.sql in Supabase.'],
  [/exceeded the maximum allowed size|Payload too large/i, 'One of the files is larger than 50 MB.'],
  [/Failed to fetch|NetworkError|Load failed/i, 'Could not reach the server. Check your connection and try again.'],
];

export function friendly(e: unknown) {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e);
  return MESSAGES.find(([re]) => re.test(msg))?.[1] ?? msg;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(friendly(error));
  return data as T;
}

export const FALLBACK_PLANS: Plan[] = [
  {
    id: 'samarppanam',
    name: 'Samarppanam',
    name_ml: 'സമർപ്പണം',
    price_inr: 10,
    summary: 'Place your belongings on the peedham.',
    features: ['Submit books, notes, music, art, video or voice', 'Sealed until Vijayadashami morning', 'A blessing verse in Malayalam and English'],
    includes_gift: false,
    includes_daily: false,
  },
  {
    id: 'prasadam',
    name: 'Prasadam',
    name_ml: 'പ്രസാദം',
    price_inr: 20,
    summary: 'Samarppanam, with a return gift.',
    features: ['Everything in Samarppanam', 'Return gift: a Saraswati photo', 'Return gift: a Saraswati Vandana slokam card', 'Return gift: a veena recital to keep'],
    includes_gift: true,
    includes_daily: false,
  },
  {
    id: 'anugraham',
    name: 'Anugraham',
    name_ml: 'അനുഗ്രഹം',
    price_inr: 30,
    summary: 'Prasadam, with a slokam every morning.',
    features: ['Everything in Prasadam', 'A good-morning email every day of Navaratri', 'Each with a slokam in Malayalam and English'],
    includes_gift: true,
    includes_daily: true,
  },
];

export function fetchPlans(): Promise<Plan[]> {
  return cached(
    'plans',
    60 * 60 * 1000,
    async () => {
      const { data, error } = await supabase.from('plans').select('*').order('sort');
      if (error || !data?.length) throw error ?? new Error('no plans');
      return data as Plan[];
    },
    { persist: true },
  ).catch(() => FALLBACK_PLANS);
}

function safeName(name: string) {
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot).replace(/[^\w.]/g, '').slice(0, 10) : '';
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60);
  return (base || 'file') + ext.toLowerCase();
}

/** Creates the submission, uploads every file into its folder, then seals it. */
export async function createAndSeal(
  input: { plan: Plan['id']; name: string; note: string; files: File[] },
  onProgress: (p: UploadProgress) => void,
): Promise<string> {
  const code = await rpc<string>('create_submission', { p_plan: input.plan, p_name: input.name, p_note: input.note });
  const totalBytes = input.files.reduce((s, f) => s + f.size, 0);
  const uploaded: StoredFile[] = [];
  let doneBytes = 0;
  for (const [i, file] of input.files.entries()) {
    onProgress({ index: i, count: input.files.length, current: file.name, doneBytes, totalBytes });
    const path = `${code}/${String(i + 1).padStart(2, '0')}-${safeName(file.name)}`;
    const type = file.type || 'application/octet-stream';
    const { error } = await supabase.storage.from('belongings').upload(path, file, { contentType: type, upsert: false });
    if (error) throw new Error(friendly(error));
    uploaded.push({ path, name: file.name, size: file.size, type });
    doneBytes += file.size;
  }
  onProgress({ index: input.files.length, count: input.files.length, current: '', doneBytes, totalBytes });
  const ok = await rpc<boolean>('seal_submission', { p_code: code, p_files: uploaded });
  invalidate('mine:');
  if (!ok) throw new Error('Could not seal your belongings. Please try again.');
  return code;
}

export async function submitPayment(code: string, paymentId: string) {
  const ok = await rpc<boolean>('submit_payment', { p_code: code, p_payment_id: paymentId.trim() });
  invalidate('mine:');
  if (!ok) throw new Error('This submission is not waiting for payment.');
}

async function userKey() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? 'anon';
}

export const mySubmissions = async (fresh = false) => {
  const key = `mine:${await userKey()}`;
  if (fresh) invalidate(key);
  return cached(key, 10_000, () => rpc<MySubmission[]>('my_submissions'));
};
export const openSubmission = (code: string) => rpc<OpenedSubmission | null>('open_submission', { p_code: code });

export async function signedUrls(bucket: 'belongings' | 'gifts', paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, 60 * 60);
  if (error) throw new Error(friendly(error));
  const out: Record<string, string> = {};
  data?.forEach((d) => {
    if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  });
  return out;
}

export async function download(bucket: 'belongings' | 'gifts', path: string, name: string) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 600, { download: name });
  if (error || !data) throw new Error(friendly(error ?? 'Download failed'));
  const a = document.createElement('a');
  a.href = data.signedUrl;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export const isAdmin = async () => cached(`admin:${await userKey()}`, 5 * 60_000, () => rpc<boolean>('is_admin'));
export const adminPayments = (status: 'pending' | 'approved' | 'rejected' | 'all') =>
  rpc<AdminPayment[]>('admin_payments', { p_status: status });
export const adminStats = () => rpc<AdminStats>('admin_stats');
export const adminReview = (id: string, approve: boolean, note?: string) =>
  rpc<boolean>('admin_review_payment', { p_id: id, p_approve: approve, p_note: note ?? null });

/** Drop every cached value tied to the signed-in user (call on sign-out). */
export const clearUserCache = () => {
  invalidate('mine:');
  invalidate('admin:');
};
