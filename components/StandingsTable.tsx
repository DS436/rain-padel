import type { Id, StandingRow } from '@/lib/types';

export function StandingsTable({
  rows,
  names,
}: {
  rows: StandingRow[];
  names: Map<Id, string>;
}) {
  return (
    <ol className="flex flex-col gap-2">
      {rows.map((r) => {
        const podium = r.position <= 3;
        return (
          <li
            key={r.playerId}
            className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${
              podium ? 'border-accent/30 bg-accent/5' : 'border-line bg-surface'
            }`}
          >
            <span
              className={`nums w-6 text-center text-sm font-semibold ${
                podium ? 'text-accent' : 'text-ink-faint'
              }`}
            >
              {r.position}
            </span>

            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-base font-medium">
                {names.get(r.playerId) ?? r.name}
                {r.active ? '' : <span className="ml-2 text-xs text-ink-faint">left</span>}
              </span>
              <span className="nums text-xs text-ink-faint">
                {r.played} played · {r.points - r.conceded >= 0 ? '+' : ''}
                {r.points - r.conceded}
              </span>
            </span>

            <span className="nums text-3xl font-semibold">{r.points}</span>
          </li>
        );
      })}
    </ol>
  );
}
