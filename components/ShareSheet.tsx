'use client';

import { useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/ui';
import { useTournament } from '@/components/TournamentProvider';
import { formatShareCode, newShare, sharePath } from '@/lib/share';
import type { Tournament } from '@/lib/types';

/**
 * Hand the night to everyone else.
 *
 * Only one person runs a padel session, but eight people want to know the
 * score, and until now the only answers were "look at my phone" or "wait for
 * the WhatsApp message at the end". A share code opens the same session on
 * anybody's phone with every edit control removed: the schedule, the live
 * scores and the table, refreshing as the organiser types.
 *
 * The code is per-session and replaceable. Regenerating it is how you take the
 * link back — from last week's group, from someone who left — and it takes
 * effect the moment it saves, because the old code no longer resolves to
 * anything.
 */
export function ShareSheet({
  tournament,
  onClose,
}: {
  tournament: Tournament;
  onClose: () => void;
}) {
  const { dispatch } = useTournament();
  const [copied, setCopied] = useState<'link' | 'text' | null>(null);

  const share = tournament.share;
  const url = share
    ? `${typeof window === 'undefined' ? '' : window.location.origin}${sharePath(share.code)}`
    : '';

  const create = () => dispatch({ type: 'SET_SHARE', share: newShare(Date.now()) });

  async function copy(what: 'link' | 'text', value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      window.prompt('Copy this:', value);
    }
    setCopied(what);
    window.setTimeout(() => setCopied(null), 2000);
  }

  const message = share
    ? `${tournament.name} — follow the scores live:\n${url}\n\nOr open rainpadel and enter code ${formatShareCode(share.code)}`
    : '';

  return (
    <Sheet title="Share this session" onClose={onClose}>
      <div className="flex flex-col gap-5 pb-2">
        {!share ? (
          <>
            <p className="text-pretty leading-relaxed text-ink-dim">
              Create a code and anyone you send it to can watch the night as it happens — who is on
              which court, the scores as they go in, and the live table. They cannot change
              anything. Only you can.
            </p>
            <Button className="w-full" onClick={create}>
              Create a share code
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-accent/30 bg-accent/[0.06] px-4 py-6">
              <span className="text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                Share code
              </span>
              <span className="nums select-all text-4xl font-semibold tracking-[0.15em] text-accent">
                {formatShareCode(share.code)}
              </span>
              <span className="break-all px-2 text-center text-xs text-ink-faint">{url}</span>
            </div>

            <div className="flex flex-col gap-2">
              <Button className="w-full" onClick={() => void copy('link', url)}>
                {copied === 'link' ? 'Link copied' : 'Copy the link'}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => void copy('text', message)}>
                {copied === 'text' ? 'Message copied' : 'Copy a message for the group'}
              </Button>
            </div>

            <section className="flex flex-col gap-2 rounded-xl border border-line bg-surface px-4 py-3">
              <h3 className="text-sm font-semibold">What they can see</h3>
              <ul className="flex flex-col gap-1 text-sm leading-relaxed text-ink-dim">
                <li>· The schedule and who is resting</li>
                <li>· Every score as you enter it</li>
                <li>· The live table, and the final results</li>
              </ul>
              <p className="text-xs text-ink-faint">
                No sign-in, nothing to install, and no way to edit a score — the buttons are not
                there.
              </p>
            </section>

            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    'Make a new code? Everyone holding the old link stops being able to see this session.',
                  )
                ) {
                  create();
                }
              }}
              className="min-h-11 text-sm text-ink-faint underline underline-offset-4"
            >
              Make a new code and revoke the old link
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}
