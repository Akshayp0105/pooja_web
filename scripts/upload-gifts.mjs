// Uploads the Prasadam return gifts into the private "gifts" bucket.
// Run once, after supabase/01_schema.sql:
//   SUPABASE_SECRET_KEY=sb_secret_... node scripts/upload-gifts.mjs
// The secret key is only used here, on your machine. Never put it in the website.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const url = 'https://acjwsvzltfqsbzfmvaua.supabase.co';
const key = process.env.SUPABASE_SECRET_KEY;
if (!key) {
  console.error('Set SUPABASE_SECRET_KEY first.');
  process.exit(1);
}

const files = [
  ['saraswati.png', 'image/png'],
  ['saraswati-vandana.png', 'image/png'],
  ['veena.mp3', 'audio/mpeg'],
];

for (const [name, type] of files) {
  const body = readFileSync(join(import.meta.dirname, '..', 'supabase', 'gifts', name));
  const res = await fetch(`${url}/storage/v1/object/gifts/${name}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': type, 'x-upsert': 'true' },
    body,
  });
  console.log(res.ok ? '✓' : '✗', name, res.ok ? '' : `${res.status} ${await res.text()}`);
}
