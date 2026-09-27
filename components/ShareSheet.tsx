'use client';

import { useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { PrimaryButton, QuietButton } from '@/components/ui';
import { Check, Copy, RotateCcw } from '@/components/icons';
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
 * The code is drawn as six tiles, three and three, because it is read out loud
 * across a court more often than it is pasted — and the tiles make "K7M, 4QD"
 * the obvious way to say it.
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
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const url = share ? `${origin}${sharePath(share.code)}` : '';

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

  if (!share) {
    return (
      <Sheet
        title="Share the night"
        description="Make a code, and anyone you send it to sees the scores as you type them. They can’t change anything — only you can."
        onClose={onClose}
      >
        <div className="pt-1">
          <PrimaryButton onClick={create}>Make a share code</PrimaryButton>
        </div>
      </Sheet>
    );
  }

  const tile =
    'flex h-[54px] w-[42px] items-center justify-center rounded-[10px] bg-surface-2 font-mono text-[26px] font-semibold';

  return (
    <Sheet
      title="Share the night"
      description="Anyone with the code sees scores as you type them. They can’t change anything."
      onClose={onClose}
    >
      <div className="flex flex-col">
        <div className="mt-1 flex items-center justify-center gap-1.5">
          <span className="sr-only">Share code {formatShareCode(share.code)}</span>
          {[...share.code.slice(0, 3)].map((ch, i) => (
            <span key={`a${i}`} aria-hidden className={tile}>
              {ch}
            </span>
          ))}
          <span aria-hidden className="h-0.5 w-2.5 bg-ink-faint" />
          {[...share.code.slice(3)].map((ch, i) => (
            <span key={`b${i}`} aria-hidden className={tile}>
              {ch}
            </span>
          ))}
        </div>
        <p className="mt-3 select-all break-all text-center text-sm text-ink-faint">
          {url.replace(/^https?:\/\//, '')}
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <PrimaryButton onClick={() => void copy('link', url)}>
            {copied === 'link' ? 'Link copied' : 'Copy link'}
            {copied === 'link' ? <Check /> : <Copy />}
          </PrimaryButton>
          <div className="flex flex-col">
            <QuietButton onClick={() => void copy('text', message)}>
              {copied === 'text' ? 'Message copied' : 'Copy a message for the group'}
            </QuietButton>
            <QuietButton
              onClick={() => {
                if (
                  window.confirm(
                    'Make a new code? Everyone holding the old link stops being able to see this session.',
                  )
                ) {
                  create();
                }
              }}
            >
              <RotateCcw size="sm" />
              New code · old links stop working
            </QuietButton>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
