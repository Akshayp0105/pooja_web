import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import { ErrorBoundary, ErrorScreen } from './components/ErrorBoundary';
import './index.css';

const root = createRoot(document.getElementById('root')!);

// Vite bakes these in at build time. If they're missing (e.g. not set in
// Vercel before deploying), say so plainly instead of rendering a blank page.
const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'].filter((k) => !import.meta.env[k]);

if (missing.length) {
  root.render(
    <ErrorScreen
      title="Site setup is incomplete"
      detail={`Missing environment variables: ${missing.join(', ')}.\n\nAdd them in Vercel → Project → Settings → Environment Variables, then redeploy.`}
    />,
  );
} else {
  // Load the app only once the config is known to be present: creating the
  // Supabase client without it throws before anything can render.
  import('./App').then(({ default: App }) =>
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <MotionConfig reducedMotion="user">
            <App />
          </MotionConfig>
        </ErrorBoundary>
      </StrictMode>,
    ),
  );
}
