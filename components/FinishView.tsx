'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Id, StandingRow, Tournament } from '@/lib/types';
import { Button } from '@/components/ui';
import { StandingsTable } from '@/components/StandingsTable';
import { resultsCsv, resultsText } from '@/lib/format';

export function FinishView({
  tournament,
  rows,
  names,
  onReopen,
}: {
  tournament: Tournament;
  rows: StandingRow[];
  names: Map<Id, string>;
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
      <div className="flex items-end justify-center gap-3">
        {[1, 0, 2].map((i) => {
          const r = podium[i];
          if (!r) return null;
          const heights = ['h-28', 'h-20', 'h-16'];
          return (
            <div key={r.playerId} className="flex w-24 flex-col items-center gap-2">
              <span className="truncate text-sm text-ink-dim">{names.get(r.playerId) ?? r.name}</span>
              <div
                className={`flex w-full flex-col items-center justify-center rounded-t-xl border border-b-0 ${
                  r.position === 1
                    ? 'border-accent bg-accent/15 ' + heights[0]
                    : 'border-line bg-surface ' + heights[r.position - 1]
                }`}
              >
                <span className="nums text-2xl font-semibold">{r.points}</span>
                <span className="text-xs text-ink-faint">{r.position}</span>
              </div>
            </div>
          );
        })}
      </div>

      <StandingsTable rows={rows} names={names} />

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
