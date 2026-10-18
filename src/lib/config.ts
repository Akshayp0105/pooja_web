// Keep UNLOCK_AT in sync with pv_unlock_at() in supabase/setup.sql.
// The server clock is what actually enforces the lock; this drives the UI.
export const UNLOCK_AT = new Date('2026-10-21T04:30:00+05:30');
export const POOJA_VEPPU_AT = new Date('2026-10-18T18:00:00+05:30');

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_FILES = 20;

export const RAZORPAY_LINK = 'https://razorpay.me/@akshayparambath';

export const UNLOCK_LABEL = 'Wed, 21 Oct 2026 · 4:30 AM IST';
