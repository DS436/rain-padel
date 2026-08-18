'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Id, StandingRow, Tournament } from '@/lib/types';
import { Button } from '@/components/ui';
import { StandingsTable } from '@/components/StandingsTable';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Crown, isCrownTier } from '@/components/Crown';
import { resultsCsv, resultsText } from '@/lib/format';

export function FinishView({
  tournament,
  rows,
  names,
  colors,
  onReopen,
}: {
  tournament: Tournament;
  rows: StandingRow[];
  names: Map<Id, string>;
  colors: Map<Id, string>;
  onReopen: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const podium = rows.slice(0, 3);

  async function copy() {
    const text = resultsText(tournament);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt('Copy the results:', text);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  function downloadCsv() {
    const blob = new Blob([resultsCsv(tournament)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tournament.name.replace(/[^\w-]+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const rematch = `/new?players=${encodeURIComponent(
    tournament.players.map((p) => p.name).join(','),
  )}&courts=${tournament.courts}&format=${tournament.format}`;

  return (
    <div className="flex flex-col gap-6">
      <Podium rows={podium} names={names} colors={colors} />

      <StandingsTable rows={rows} names={names} colors={colors} />

      <div className="flex flex-col gap-2">
        <Button onClick={() => void copy()} className="w-full">
          {copied ? 'Copied' : 'Copy results'}
        </Button>
        <Button variant="ghost" onClick={downloadCsv} className="w-full">
          Download CSV
        </Button>
        <Link href={rematch} className="block">
          <Button variant="ghost" className="w-full">
            New session, same players
          </Button>
        </Link>
        <button
          type="button"
          onClick={onReopen}
          className="min-h-11 text-sm text-ink-faint underline underline-offset-4"
        >
          Reopen to fix a score
        </button>
      </div>
    </div>
  );
}

/** 2 – 1 – 3, the way a podium actually looks. */
function Podium({
  rows,
  names,
  colors,
}: {
  rows: StandingRow[];
  names: Map<Id, string>;
  colors: Map<Id, string>;
}) {
  const winner = rows[0];
  if (!winner) return null;

  const order = [rows[1], rows[0], rows[2]].filter(Boolean) as StandingRow[];
  const heights: Record<number, string> = { 1: 'h-24', 2: 'h-16', 3: 'h-12' };

  return (
    <section className="flex flex-col items-center gap-5 rounded-2xl border border-line bg-surface/60 p-5">
      <div className="flex flex-col items-center gap-1">
        <p className="text-lg font-semibold">Well played, {names.get(winner.playerId) ?? winner.name}</p>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          <Stat label="Points" value={String(winner.points)} accent />
          <Stat label="Wins" value={String(winner.wins)} />
          <Stat
            label="Diff"
            value={
              winner.points - winner.conceded > 0
                ? `+${winner.points - winner.conceded}`
                : String(winner.points - winner.conceded)
            }
          />
        </div>
      </div>

      <ol className="flex w-full items-end justify-center gap-2">
        {order.map((r) => (
          <li key={r.playerId} className="flex w-24 flex-col items-center gap-2">
            <PlayerAvatar
              name={names.get(r.playerId) ?? r.name}
              color={colors.get(r.playerId)}
              size="lg"
            />
            <span className="max-w-full truncate text-sm text-ink-dim">
              {names.get(r.playerId) ?? r.name}
            </span>
            <div
              className={`flex w-full flex-col items-center justify-center gap-1 rounded-t-xl border border-b-0 pt-2 ${
                heights[r.position] ?? 'h-12'
              } ${r.position === 1 ? 'border-accent/40 bg-accent/10' : 'border-line bg-surface-2'}`}
            >
              {isCrownTier(r.position) ? <Crown tier={r.position} className="h-6 w-6" /> : null}
              <span className="nums text-lg font-semibold">{r.points}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <span
      className={`nums rounded-full px-3 py-1 text-xs ${
        accent ? 'bg-accent/15 text-accent' : 'bg-surface-2 text-ink-dim'
      }`}
    >
      {label} {value}
    </span>
  );
}
