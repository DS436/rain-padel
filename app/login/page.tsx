'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { useAuth } from '@/components/AuthProvider';

export default function LoginPage() {
  const router = useRouter();
  const { session, loading, devMode, signIn } = useAuth();

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && (session || devMode)) router.replace('/sessions');
  }, [loading, session, devMode, router]);

  useEffect(() => {
    input.current?.focus();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const message = await signIn(password);
    if (message) {
      setError(message);
      setPassword('');
      setBusy(false);
      input.current?.focus();
      return;
    }
    router.replace('/sessions');
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-5 py-16">
      <div>
        <Link href="/" className="text-sm text-ink-faint underline underline-offset-4">
          Rain Padel
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Enter the password</h1>
        <p className="mt-2 text-sm text-ink-dim">
          Just the password — no email, no account to remember.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <input
          ref={input}
          type="password"
          required
          autoComplete="current-password"
          enterKeyHint="go"
          aria-label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="min-h-14 rounded-xl border border-line bg-surface px-4 text-center text-xl tracking-widest focus:border-accent focus:outline-none"
        />

        {error ? (
          <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-center text-sm text-danger">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={busy || !password} className="w-full">
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      {/*
        The emailed-code flow is already wired in AuthProvider (requestCode /
        verifyCode, with shouldCreateUser:false so it stays invite-only). It
        needs an email template in the Supabase dashboard and a two-step form
        here — no backend work — whenever this stops being a one-person app.
      */}
      <p className="text-xs text-ink-faint">
        Invite only. Sign-in by emailed code is ready to switch on when other people need accounts.
      </p>
    </main>
  );
}
