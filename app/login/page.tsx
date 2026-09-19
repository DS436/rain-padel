'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { Ball } from '@/components/SiteChrome';
import { Eye, Lock } from '@/components/icons';

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
    /* The mock's sign-in: the mark and the promise pinned to the top, the two
       ways in pinned to the bottom, and nothing in between. On a phone the
       thumb never has to travel to the middle of the screen. */
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-between px-5 pb-8">
      <div className="pt-24">
        <Ball className="h-10 w-10" />
        <h1 className="disp mt-5 text-[38px] font-bold leading-none tracking-[-0.03em]">
          Rain Padel
        </h1>
        <p className="mt-2.5 text-[14.5px] leading-relaxed text-ink-dim">
          Who turned up. Who plays whom. Who won.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-2.5">
        <label className="flex min-h-[52px] items-center gap-2.5 rounded-[14px] border border-line bg-surface px-3.5 focus-within:border-accent">
          <Lock className="text-ink-faint" />
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

        {error ? (
          <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-center text-[13px] text-danger">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy || !password}
          className="disp min-h-[52px] rounded-[14px] bg-accent text-[15.5px] font-bold text-accent-ink transition-opacity active:opacity-80 disabled:bg-surface-2 disabled:text-ink-faint"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <Link
          href="/watch"
          className="inline-flex min-h-[52px] items-center justify-center gap-[7px] rounded-[14px] border border-line text-[14.5px] font-semibold text-ink"
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
        <p className="pt-1 text-center text-[11px] leading-relaxed text-ink-faint">
          Invite only. Sign-in by emailed code is ready to switch on when other people need
          accounts.
        </p>
      </form>
    </main>
  );
}
