'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { formatShareCode, normaliseShareCode, sharePath } from '@/lib/share';

/**
 * The front door for everybody who is not running the night.
 *
 * A link is the fast path, but links die in group chats and somebody always
 * ends up reading the code out loud instead — so typing it has to work just as
 * well. The field accepts it in whatever shape it arrives: lower case, with or
 * without the dash, with a stray space from a paste.
 */
export function WatchForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalised = normaliseShareCode(code);
    if (!normalised) {
      setError('A share code is six characters, like K7M-4QD.');
      return;
    }
    router.push(sharePath(normalised));
  };

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-5 py-16">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Watch the night</h1>
        <p className="mt-3 text-pretty leading-relaxed text-ink-dim">
          Enter the code from whoever is running the session. You will see the courts, the scores
          as they go in, and the live table.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor="code" className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Share code
        </label>
        <input
          id="code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="K7M-4QD"
          className="nums min-h-14 rounded-xl border border-line bg-surface text-center text-2xl font-semibold uppercase tracking-[0.2em] text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" className="w-full">
          Open the scoreboard
        </Button>
      </form>

      <p className="text-center text-sm text-ink-faint">
        Running the night yourself?{' '}
        <Link href="/login" className="text-accent underline underline-offset-4">
          Sign in
        </Link>
      </p>

      {/* Reassurance, because "enter a code" reads like a sign-up to a lot of
          people and this is the opposite of one. */}
      <p className="text-center text-xs text-ink-faint">
        No account, nothing to install. {formatShareCode('EXAMPL')} is only an example.
      </p>
    </div>
  );
}
