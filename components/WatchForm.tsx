'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatShareCode, normaliseShareCode, sharePath } from '@/lib/share';
import { Ball } from '@/components/SiteChrome';
import { ArrowRight, Eye } from '@/components/icons';

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
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-between px-5 pb-8">
      <div className="pt-24">
        <Ball className="h-10 w-10" />
        <h1 className="disp mt-5 text-[34px] font-bold leading-none tracking-[-0.03em]">
          Watch the night
        </h1>
        <p className="mt-2.5 text-pretty text-[14.5px] leading-relaxed text-ink-dim">
          Enter the code from whoever is running the session. You will see the courts, the scores
          as they go in, and the live table.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-2.5">
        <label
          htmlFor="code"
          className="disp text-[9.5px] font-bold uppercase tracking-[0.18em] text-ink-faint"
        >
          Share code
        </label>
        <div className="flex min-h-[52px] items-center gap-2.5 rounded-[14px] border border-line bg-surface px-3.5 focus-within:border-accent">
          <Eye className="text-ink-faint" />
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
            className="nums disp min-w-0 flex-1 bg-transparent text-xl font-bold uppercase tracking-[0.08em] text-accent placeholder:font-medium placeholder:text-ink-faint focus:outline-none"
          />
        </div>
        {error ? <p className="text-[13px] text-danger">{error}</p> : null}

        <button
          type="submit"
          className="disp inline-flex min-h-[52px] items-center justify-center gap-[7px] rounded-[14px] bg-accent text-[15.5px] font-bold text-accent-ink transition-opacity active:opacity-80"
        >
          Open the scoreboard
          <ArrowRight size="sm" />
        </button>

        <p className="pt-1 text-center text-[11.5px] text-ink-faint">
          Running the night yourself?{' '}
          <Link href="/login" className="font-semibold text-accent">
            Sign in
          </Link>
        </p>

        {/* Reassurance, because "enter a code" reads like a sign-up to a lot of
            people and this is the opposite of one. */}
        <p className="text-center text-[11px] text-ink-faint">
          No account, nothing to install. {formatShareCode('EXAMPL')} is only an example.
        </p>
      </form>
    </div>
  );
}
