# Pooja Veppu · പൂജവെയ്പ്

Offer books, notes, music, art, video or voice before Goddess Saraswati. Each offering is
sealed until **Vijayadashami, 21 Oct 2026, 4:30 AM IST**, then returns with a unique
blessing from the scriptures in Malayalam and English.

## Setup

1. Supabase Dashboard → **SQL Editor** → paste `supabase/01_schema.sql` → **Run** (once).
2. `npm install`
3. `npm run dev` for local work, or `npm run build` and deploy `dist/` (Vercel, Netlify, Cloudflare Pages).
   Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the host's environment.

## How the lock works

- The `offerings` table has RLS on with no policies; the browser reaches it only through
  `reserve_offering`, `seal_offering` and `get_offering`.
- Files live in the private `offerings` bucket. Storage refuses every read until
  `pv_unlock_at()`, decided by the database clock, so changing the device clock does nothing.
- Before unlock, `get_offering` returns only a summary (no files, note or blessing).
- Each offering gets a sequential number; `src/lib/quotes.ts` maps it to one of 52
  blessings, so the first 52 offerings all get different verses.

To change the unlock time, edit both `pv_unlock_at()` in `supabase/01_schema.sql` (re-run it)
and `UNLOCK_AT` in `src/lib/config.ts`.

Only the **publishable** key belongs in this app. Never put the secret key in frontend code.

## Chants & audio

- `public/audio/` holds freely licensed recordings from Wikimedia Commons (credits in the
  site footer and `src/lib/tracks.ts`). One plays softly in the background, starting on the
  next track each visit. Browsers only allow sound after the first tap or key press.
- The Listen button on each slokam uses the device's speech voice (Hindi/Sanskrit voice
  reading Devanagari, or a Malayalam voice). To use your own recordings instead, add MP3s to
  `public/audio/` and list them in `src/lib/tracks.ts`.
