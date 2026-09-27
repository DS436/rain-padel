'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { Ball } from '@/components/SiteChrome';
import { Eye, Lock } from '@/components/icons';
import { PrimaryButton } from '@/components/ui';

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
    /* The mark and the promise pinned to the top, the two ways in pinned to
       the bottom, and nothing in between. On a phone the thumb never has to
       travel to the middle of the screen. */
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-between px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="pt-20">
        <Ball className="h-10 w-10" />
        <h1 className="mt-6 text-[44px] font-semibold leading-[1.05] tracking-[-0.035em]">
          Rain Padel
        </h1>
        <p className="mt-2 text-[15px] leading-normal text-ink-dim">
          Who turned up. Who plays whom. Who won.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col pt-10">
        <label className="card flex h-[52px] items-center gap-2.5 px-4 text-ink-faint focus-within:shadow-[0_0_0_2px_var(--color-accent)]">
          <Lock />
          <input
            ref={input}
            type="password"
            required
            autoComplete="current-password"
            enterKeyHint="go"
            aria-label="Organiser password"
            placeholder="Organiser password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-faint focus:outline-none"
          />
        </label>

        {error ? <p className="mt-2 px-1 text-center text-[13px] text-danger">{error}</p> : null}

        <PrimaryButton type="submit" disabled={busy || !password} className="mt-3">
          {busy ? 'Signing in…' : 'Sign in'}
        </PrimaryButton>

        {/* The other way in, as a word with an icon — one primary per screen. */}
        <Link
          href="/watch"
          className="mt-1 inline-flex min-h-11 items-center justify-center gap-1.5 text-[15px] font-medium text-ink-dim active:opacity-70"
        >
          <Eye size="sm" />
          Watch with a code
        </Link>

        {/*
          The emailed-code flow is already wired in AuthProvider (requestCode /
          verifyCode, with shouldCreateUser:false so it stays invite-only). It
          needs an email template in the Supabase dashboard and a two-step form
          here — no backend work — whenever this stops being a one-person app.
        */}
        <p className="pt-2 text-center text-xs leading-relaxed text-ink-faint">
          Invite only. Sign-in by emailed code is ready to switch on when other people need
          accounts.
        </p>
      </form>
    </main>
  );
}
