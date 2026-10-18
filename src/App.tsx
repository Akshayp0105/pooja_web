import { lazy, Suspense, useEffect, useState } from 'react';
import { AudioProvider } from './components/AudioProvider';
import { AuthDialog } from './components/AuthDialog';
import { CollectSection } from './components/CollectSection';
import { Hero } from './components/Hero';
import { Mantras } from './components/Mantras';
import { MusicDock } from './components/MusicDock';
import { Navbar } from './components/Navbar';
import { OfferSection } from './components/OfferSection';
import { Backdrop, Petals } from './components/ornaments';
import { Plans } from './components/Plans';
import { Footer, Guidelines, Ritual } from './components/Ritual';
import { AuthProvider } from './lib/auth';
import { PlansProvider } from './lib/plans';

const Admin = lazy(() => import('./components/Admin').then((m) => ({ default: m.Admin })));

/** "#/admin" is a separate page; any other hash is an in-page anchor. */
function useRoute() {
  const get = () => (location.hash.startsWith('#/admin') ? 'admin' : 'home');
  const [route, setRoute] = useState(get);
  useEffect(() => {
    const on = () => setRoute(get());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export default function App() {
  const route = useRoute();
  return (
    <AuthProvider>
      <PlansProvider>
        <AudioProvider>
          <div className="relative isolate min-h-screen overflow-x-clip">
            <Backdrop />
            {route === 'admin' ? (
              <>
                <Navbar admin />
                <Suspense fallback={null}>
                  <Admin />
                </Suspense>
              </>
            ) : (
              <>
                <Petals />
                <Navbar />
                <main className="relative z-10">
                  <Hero />
                  <Plans />
                  <OfferSection />
                  <CollectSection />
                  <Ritual />
                  <Mantras />
                  <Guidelines />
                </main>
                <Footer />
                <MusicDock />
              </>
            )}
            <AuthDialog />
          </div>
        </AudioProvider>
      </PlansProvider>
    </AuthProvider>
  );
}
