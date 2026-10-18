# Pooja Veppu · പൂജവെയ്പ്

People sign in with an email code, pick a plan, submit their belongings (books, notes, music,
art, video, voice), pay on Razorpay, and get everything back on **Vijayadashami, 21 Oct 2026,
4:30 AM IST** with a blessing verse in Malayalam and English.

| Plan | Price | Includes |
| --- | --- | --- |
| Samarppanam · സമർപ്പണം | ₹10 | Submission, sealed until Vijayadashami, blessing verse |
| Prasadam · പ്രസാദം | ₹20 | + return gift: Saraswati photo, Saraswati Vandana card, veena recital |
| Anugraham · അനുഗ്രഹം | ₹30 | + good-morning email with a slokam every day until Vijayadashami |

## Setup (in this order)

1. **Database.** Supabase → SQL Editor → paste `supabase/01_schema.sql` → Run.
2. **Email code template.** Supabase → Authentication → Email Templates → **Magic Link**.
   Replace the body so it shows the code:
   ```html
   <h2>Your Pooja Veppu sign-in code</h2>
   <p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p>
   <p>Or <a href="{{ .ConfirmationURL }}">sign in with this link</a>. The code expires in 1 hour.</p>
   ```
   Do the same for the **Confirm signup** template (new users get that one first).
3. **Site URL.** Authentication → URL Configuration → set Site URL to your live address and add
   `http://localhost:4173` and `http://localhost:5173` to Redirect URLs.
4. **Email sending limit.** Supabase’s built-in mailer only sends a few emails per hour. Before
   launch, connect Resend: Authentication → SMTP Settings → host `smtp.resend.com`, port `465`,
   user `resend`, password = your Resend API key, sender = an address on your verified domain.
5. **Return gifts.** `SUPABASE_SECRET_KEY=sb_secret_... node scripts/upload-gifts.mjs`
6. **Daily emails (₹30 plan).** Put your Resend API key into `supabase/02_daily_email.sql`, then
   run it in the SQL Editor. Set `email_from` and `site_url` as the file explains.
7. **Run it.** `npm install`, then `npm run dev`, or `npm run build` and deploy `dist/`.

## Deploying on Vercel

1. vercel.com → Add New → Project → import this folder (from GitHub, or run `npx vercel` here).
   Framework, build command and output are already set in `vercel.json`.
2. Project → Settings → Environment Variables: add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_PUBLISHABLE_KEY` (values in `.env.example`). Never add the secret key.
3. Deploy, then put the Vercel address (e.g. `https://pooja-veppu.vercel.app`) into:
   - Supabase → Authentication → URL Configuration → Site URL and Redirect URLs
   - `update app_settings set value = 'https://pooja-veppu.vercel.app' where key = 'site_url';`

## Security

- Database: row-level security on every table; all access through checked functions.
- Limits: 10 submissions/hour and 5 unpaid at a time per account; 20 files, 50 MB each,
  500 MB total; 5 Payment ID attempts/hour; 3 rejections per submission before support.
- Each Payment ID can be used only once; every approve/reject is recorded in `admin_audit`.
- Files are private; upload paths are strictly validated; reads only by the owner after unlock.
- `vercel.json` sends a strict Content-Security-Policy, blocks framing (clickjacking), forces
  HTTPS, and allows the microphone only for this site.
- Optional bot protection on sign-in: create a Cloudflare Turnstile widget, put its site key in
  `VITE_TURNSTILE_SITE_KEY` (Vercel env var), and in Supabase → Authentication → Attack
  Protection enable CAPTCHA with provider Turnstile and its secret key.

## Approving payments

Payments go to `razorpay.me/@akshayparambath`. After paying, a person pastes their Razorpay
Payment ID (`pay_…`) on the site. Sign in as an admin and open **`/#/admin`** (also in the account
menu): each pending payment shows the person, plan, expected amount and a link straight to that
payment in the Razorpay Dashboard. Approve if the amount matches; reject with a note otherwise
(the person can then enter a corrected ID).

Admins are listed in the `app_admins` table. `akshay@samosainteractive.com` is added by default:
```sql
insert into app_admins (email) values ('someone@example.com');
```

## Database

| Table | Holds |
| --- | --- |
| `profiles` | name, mobile, email for each signed-in person |
| `plans` | the three plans and their prices (edit here to change prices) |
| `submissions` | each sealed submission, its plan, blessing and status |
| `submission_files` | the files in each submission |
| `payments` | Razorpay Payment IDs and their approval state |
| `blessings` | 52 verses; each submission is assigned a different one |
| `return_gifts` | the three Prasadam gifts |
| `daily_messages` | one good-morning message and slokam per day |
| `notification_log` | every daily email sent (at most one per person per day) |
| `app_admins`, `app_settings` | admin emails; sender address and site URL |

All tables have row-level security with no direct browser access; the site only calls the
functions in `01_schema.sql`, which check who is signed in, their plan, payment status and the
unlock time. Files are in private buckets: people can upload only into their own unsealed
submission, and read only their own confirmed files, only from Vijayadashami.

To change the unlock time, edit `pv_unlock_at()` in `01_schema.sql` (re-run it) and `UNLOCK_AT`
in `src/lib/config.ts`.

## Chants & audio

`public/audio/` holds freely licensed recordings from Wikimedia Commons (credited in the footer
and in `src/lib/tracks.ts`). One plays softly in the background, a different one each visit;
browsers only allow sound after the first tap. The Listen button on each slokam uses the
device’s own speech voice.

Only the **publishable** key belongs in the website. Never put the secret key in frontend code.
