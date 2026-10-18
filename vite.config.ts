import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `vite preview` serves the same security headers as Vercel, so the CSP is
// exercised locally before deploying (upgrade-insecure-requests is dropped
// because preview runs on plain http://localhost).
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'));
const previewHeaders: Record<string, string> = Object.fromEntries(
  vercel.headers[0].headers
    .filter((h: { key: string }) => h.key !== 'Strict-Transport-Security')
    .map((h: { key: string; value: string }) => [h.key, h.value.replace('; upgrade-insecure-requests', '')]),
);

export default defineConfig({
  plugins: [react()],
  preview: { headers: previewHeaders },
});
