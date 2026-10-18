import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { friendly } from './api';
import { supabase } from './supabase';

export type Profile = { id: string; email: string | null; full_name: string | null; phone: string | null };

type AuthApi = {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  /** True once the user has a name and phone on file. */
  complete: boolean;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  saveProfile: (p: { full_name: string; phone: string }) => Promise<void>;
  signOut: () => Promise<void>;
  /** Opens the sign-in dialog; resolves true once signed in with a complete profile. */
  requireAuth: () => Promise<boolean>;
  dialogOpen: boolean;
  closeDialog: (ok: boolean) => void;
};

const Ctx = createContext<AuthApi | null>(null);

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}

let resolver: ((ok: boolean) => void) | null = null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) return setProfile(null);
    const { data } = await supabase.from('profiles').select('id, email, full_name, phone').eq('id', s.user.id).maybeSingle();
    setProfile((data as Profile) ?? { id: s.user.id, email: s.user.email ?? null, full_name: null, phone: null });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      loadProfile(s);
    });
    return () => data.subscription.unsubscribe();
  }, [loadProfile]);

  const complete = !!(profile?.full_name && profile?.phone);

  const api: AuthApi = {
    ready,
    session,
    profile,
    complete,
    sendCode: async (email) => {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true, emailRedirectTo: location.origin + location.pathname },
      });
      if (error) {
        if (/rate limit|security purposes/i.test(error.message)) throw new Error('Too many codes requested. Please wait a minute and try again.');
        throw new Error(friendly(error));
      }
    },
    verifyCode: async (email, code) => {
      const { data, error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: 'email' });
      if (error) throw new Error(/expired|invalid/i.test(error.message) ? 'That code is wrong or has expired. Request a new one.' : friendly(error));
      setSession(data.session);
      await loadProfile(data.session);
    },
    saveProfile: async ({ full_name, phone }) => {
      if (!session) throw new Error('Please sign in again.');
      const { error } = await supabase.from('profiles').update({ full_name: full_name.trim(), phone }).eq('id', session.user.id);
      if (error) throw new Error(/phone/i.test(error.message) ? 'Enter a valid mobile number.' : friendly(error));
      await loadProfile(session);
    },
    signOut: async () => {
      await supabase.auth.signOut();
      setProfile(null);
    },
    requireAuth: () => {
      if (session && complete) return Promise.resolve(true);
      setDialogOpen(true);
      return new Promise((r) => (resolver = r));
    },
    dialogOpen,
    closeDialog: (ok) => {
      setDialogOpen(false);
      resolver?.(ok);
      resolver = null;
    },
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
