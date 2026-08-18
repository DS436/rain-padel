'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '@/lib/store';
import { getSupabase } from '@/lib/supabase/client';

export interface AuthState {
  session: Session | null;
  email: string | null;
  loading: boolean;
  /** true when there is no database configured and the app runs unauthenticated */
  devMode: boolean;
  /** Password-only: the account email lives server-side, see /api/login. */
  signIn(password: string): Promise<string | null>;
  signOut(): Promise<void>;
  /** Emailed one-time code — see the note below. */
  requestCode(email: string): Promise<string | null>;
  verifyCode(email: string, code: string): Promise<string | null>;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabase();

    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));

    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, [configured]);

  const signIn = useCallback<AuthState['signIn']>(async (password) => {
    if (!configured) return 'No database connected yet.';

    // The route holds the account address and does the actual sign-in, then
    // hands back the tokens for this client to adopt.
    let payload: { access_token?: string; refresh_token?: string; error?: string };
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      payload = (await res.json()) as typeof payload;
      if (!res.ok) return payload.error ?? 'Could not sign in.';
    } catch {
      return 'Could not reach the server.';
    }

    if (!payload.access_token || !payload.refresh_token) return 'Could not sign in.';

    const { error } = await getSupabase().auth.setSession({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
    });
    return error ? friendly(error.message) : null;
  }, [configured]);

  const signOut = useCallback(async () => {
    if (!configured) return;
    await getSupabase().auth.signOut();
  }, [configured]);

  /**
   * The emailed-code flow, ready but not the front door yet.
   *
   * `shouldCreateUser: false` is what makes this an invite-only app: an address
   * that has no user in Supabase gets nothing, so there is no signup to police.
   * Turning this on is a UI change plus an email template in the Supabase
   * dashboard — no new backend.
   */
  const requestCode = useCallback<AuthState['requestCode']>(async (email) => {
    if (!configured) return 'No database connected yet.';
    const { error } = await getSupabase().auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    return error ? friendly(error.message) : null;
  }, [configured]);

  const verifyCode = useCallback<AuthState['verifyCode']>(async (email, code) => {
    if (!configured) return 'No database connected yet.';
    const { error } = await getSupabase().auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
    return error ? friendly(error.message) : null;
  }, [configured]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      email: session?.user.email ?? null,
      loading,
      devMode: !configured,
      signIn,
      signOut,
      requestCode,
      verifyCode,
    }),
    [session, loading, configured, signIn, signOut, requestCode, verifyCode],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Supabase's messages are accurate but blunt; soften the ones users will hit. */
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) {
    return 'That email and password combination is not recognised.';
  }
  if (m.includes('signups not allowed') || m.includes('not found')) {
    return 'That email is not on the list yet.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Too many attempts — wait a minute and try again.';
  }
  if (m.includes('token has expired') || m.includes('invalid token')) {
    return 'That code is wrong or has expired.';
  }
  return message;
}
