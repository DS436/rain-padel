'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatShareCode, normaliseShareCode, sharePath } from '@/lib/share';
import { GroupLabel, PageTitle, PrimaryButton, TopBar } from '@/components/ui';
import { ArrowRight, Eye } from '@/components/icons';

/**
 * The front door for everybody who is not running the night.
 *
 * A link is the fast path, but links die in group chats and somebody always
 * ends up reading the code out loud instead — so typing it has to work just as
 * well. The field accepts it in whatever shape it arrives: lower case, with or
 * without the dash, with a stray space from a paste.
 *
 * Laid out like every other setup screen: the question at the top, the one
 * field under it, and the button pinned to the bottom where the thumb is.
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
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col">
      <TopBar back={{ href: '/', label: 'Rain Padel' }} />
      <PageTitle sub="Enter the code from whoever is running the session. You will see the courts, the scores as they go in, and the live table.">
        Watch the night
      </PageTitle>

      <form
        onSubmit={submit}
        className="flex flex-1 flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4"
      >
        <GroupLabel>
          <label htmlFor="code">Share code</label>
        </GroupLabel>
        <div className="card flex h-14 items-center gap-2.5 px-4 text-ink-faint focus-within:shadow-[0_0_0_2px_var(--color-accent)]">
          <Eye />
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
            className="nums min-w-0 flex-1 bg-transparent text-[22px] font-semibold uppercase tracking-[0.08em] text-ink placeholder:font-medium placeholder:text-ink-faint focus:outline-none"
          />
        </div>
        {error ? <p className="mt-2 px-1 text-[13px] text-danger">{error}</p> : null}

        {/* Reassurance, because "enter a code" reads like a sign-up to a lot of
            people and this is the opposite of one. */}
        <p className="mt-3 px-1 text-[13px] text-ink-faint">
          No account, nothing to install. {formatShareCode('EXAMPL')} is only an example.
        </p>

        <div className="mt-auto flex flex-col gap-1 pt-10">
          <PrimaryButton type="submit">
            Open the scoreboard
            <ArrowRight />
          </PrimaryButton>
          <p className="text-center text-[13px] text-ink-faint">
            Running the night yourself?{' '}
            <Link href="/login" className="inline-flex min-h-11 items-center font-semibold text-accent-text">
              Sign in
            </Link>
          </p>
        </div>
      </form>
    </main>
  );
}
