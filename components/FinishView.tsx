'use client';

import { useMemo, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import type { Id, StandingRow, Tournament } from '@/lib/types';
import { StandingsTable } from '@/components/StandingsTable';
import { PlayerSpotlight } from '@/components/PlayerSpotlight';
import { AvatarStack, PlayerAvatar } from '@/components/PlayerAvatar';
import { BracketView } from '@/components/BracketView';
import {
  BarAction,
  BottomBar,
  Group,
  GroupLabel,
  PrimaryButton,
  QuietButton,
} from '@/components/ui';
import {
  Activity,
  Award,
  Check,
  ChevronDown,
  Copy,
  Download,
  Flame,
  Home,
  RefreshCw,
  Shield,
  Timer,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from '@/components/icons';
import { champion, podiumPairs } from '@/lib/knockout';
import { buildProgression } from '@/lib/progression';
import { finishLines, ordinal, shareText, superlatives, type Superlative } from '@/lib/awards';
import { rematchQuery, resultsCsv } from '@/lib/format';
import { counterNoun } from '@/lib/cycles';

/**
 * The last screen of the night, and the one that gets read out loud.
 *
 * The cobalt list gives it a headline sentence and a podium — second, first,
 * third, with the winner's block the one thing on the screen in the accent —
 * then a single grey line for the bottom of the table, because the wooden
 * spoon is a running joke worth putting on the screen. Under that the awards
 * sit as a plain list. The full table is one tap away rather than on the page:
 * by now everybody has seen it, and it was pushing the awards off the bottom.
 *
 * Every way out of the session lives in a bar pinned to the bottom — copy,
 * CSV, the same players again, home — with the one thing most people do next
 * as the primary button: play on.
 */
export function FinishView({
  tournament,
  rows,
  names,
  colors,
  onReopen,
  onPlayAnother,
}: {
  tournament: Tournament;
  rows: StandingRow[];
  names: Map<Id, string>;
  colors: Map<Id, string>;
  /**
   * Both absent on the read-only spectator view: a viewer can copy the results
   * and export them, but reopening the night or playing on is the organiser's
   * call — so without them there is no pinned bar and no edit action at all.
   */
  onReopen?: () => void;
  onPlayAnother?: () => void;
  /**
   * No longer drawn here — sharing moved to the session header, where it
   * sits on every tab. Still accepted so a caller passing it keeps compiling.
   */
  onShare?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState<Id | null>(null);
  const [tableOpen, setTableOpen] = useState(false);
  const [bracketOpen, setBracketOpen] = useState(false);
  const organiser = Boolean(onPlayAnother || onReopen);

  const progression = useMemo(() => buildProgression(tournament), [tournament]);
  const lines = useMemo(
    () => finishLines(tournament, rows, progression),
    [tournament, rows, progression],
  );
  const awards = useMemo(
    () => superlatives(tournament, rows, progression),
    [tournament, rows, progression],
  );
  const seriesById = useMemo(
    () => new Map(progression.series.map((s) => [s.playerId, s] as const)),
    [progression],
  );

  // When a bracket was played, the final decided the night — the points table
  // becomes the qualifying table it always was, and stays one tap away.
  const champions = useMemo(() => champion(tournament), [tournament]);
  const bracketPodium = useMemo(() => podiumPairs(tournament), [tournament]);

  const nameOf = (id: Id, fallback = 'Unknown') => names.get(id) ?? fallback;
  const winner = rows[0] && rows[0].played > 0 ? rows[0] : null;

  // "Elena takes Tuesday." — the night named by its weekday, because that is
  // what the group calls it ("Tuesday padel"), in English because the rest of
  // the copy is.
  const weekday = new Date(tournament.createdAt).toLocaleDateString('en-GB', { weekday: 'long' });
  const headline = champions
    ? `${champions.name} take the title.`
    : winner
      ? `${nameOf(winner.playerId, winner.name)} takes ${weekday}.`
      : `${tournament.name} is over.`;
  const subline = champions
    ? `Seeded ${champions.seed} · won the final`
    : winner
      ? lines.find((l) => l.playerId === winner.playerId)?.line
      : null;

  const podium: PodiumPlace[] = champions
    ? bracketPodium
        .filter((p) => p.place <= 3)
        .map(({ place, pair }) => ({
          key: `seed-${pair.seed}`,
          place,
          name: pair.name,
          face: (
            <AvatarStack
              people={pair.players.map((id) => ({ name: nameOf(id, '?'), color: colors.get(id) }))}
              size="md"
              ring="var(--color-ground)"
            />
          ),
          big: ordinal(place),
          small: `seed ${pair.seed}`,
          onOpen: () => setOpen(pair.players[0]),
        }))
    : winner
      ? rows.slice(0, 3).map((r, i) => ({
          key: r.playerId,
          place: i + 1,
          name: nameOf(r.playerId, r.name),
          face: (
            <PlayerAvatar
              name={nameOf(r.playerId, r.name)}
              color={colors.get(r.playerId)}
              size={i === 0 ? 'xl' : 'lg'}
            />
          ),
          big: String(r.points),
          // the standing's own position, so a tie for second reads "2nd" twice
          small: ordinal(r.position),
          onOpen: () => setOpen(r.playerId),
        }))
      : [];

  // The one grey line under the podium: fourth in a bracket, otherwise the
  // wooden spoon — the same "last of four or more" rule the award copy uses.
  const spoon = lines.find((l) => l.badge === 'Wooden spoon');
  const spoonRow = spoon ? rows.find((r) => r.playerId === spoon.playerId) : undefined;
  const fourth = champions ? bracketPodium.find((p) => p.place === 4) : undefined;
  const footnote = fourth
    ? `4th · ${fourth.pair.name}`
    : spoonRow
      ? `Wooden spoon · ${nameOf(spoonRow.playerId, spoonRow.name)}, ${spoonRow.points} point${
          spoonRow.points === 1 ? '' : 's'
        }`
      : null;

  async function copy() {
    const text = shareText(tournament, rows, progression);
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

  const openRow = open ? rows.find((r) => r.playerId === open) : null;
  const openSeries = open ? seriesById.get(open) : null;

  const copyAction = (
    <BarAction
      wide
      icon={copied ? <Check /> : <Copy />}
      label={copied ? 'Copied' : 'Copy'}
      onClick={() => void copy()}
    />
  );
  const csvAction = <BarAction wide icon={<Download />} label="CSV" onClick={downloadCsv} />;

  return (
    // The pinned bar is two rows tall; the padding keeps the last award and
    // the reopen link scrollable out from under it.
    <div className={`flex flex-col ${organiser ? 'pb-36' : ''}`}>
      <h2 className="text-pretty text-2xl font-semibold leading-tight tracking-[-0.02em]">
        {headline}
      </h2>
      {subline ? <p className="mt-1 text-pretty text-sm text-ink-dim">{subline}</p> : null}

      {podium.length > 0 ? <Podium places={podium} /> : null}

      <p className="mt-2.5 flex flex-wrap items-center justify-center gap-x-1 text-center text-[13px] text-ink-faint">
        {footnote ? <span>{footnote} ·</span> : null}
        <button
          type="button"
          onClick={() => setTableOpen((v) => !v)}
          aria-expanded={tableOpen}
          className="-my-2.5 inline-flex min-h-11 items-center px-1 text-ink-faint active:opacity-60"
        >
          {tableOpen ? 'Hide table' : 'Full table ›'}
        </button>
      </p>

      {tableOpen ? (
        <section className="rp-rise mt-2">
          {champions ? <GroupLabel className="!mt-2">The table that seeded it</GroupLabel> : null}
          <StandingsTable tournament={tournament} rows={rows} names={names} colors={colors} />
        </section>
      ) : null}

      {/* ----------------------------- bracket ---------------------------- */}
      {tournament.knockout ? (
        <div className="card mt-4 overflow-hidden">
          <button
            type="button"
            onClick={() => setBracketOpen((v) => !v)}
            aria-expanded={bracketOpen}
            className="flex min-h-12 w-full items-center gap-2.5 px-4 text-left text-sm text-ink-dim active:bg-surface-2"
          >
            <span className="flex-1">The whole bracket</span>
            <ChevronDown
              size="sm"
              className={`text-ink-faint transition-transform ${bracketOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {bracketOpen ? (
            <div className="border-t border-line p-4">
              <BracketView tournament={tournament} colors={colors} />
            </div>
          ) : null}
        </div>
      ) : null}

      {awards.length > 0 ? (
        <Awards awards={awards} onOpen={(id) => setOpen(id)} />
      ) : null}

      {onReopen ? (
        <QuietButton onClick={onReopen} className="mt-4 !text-sm !text-ink-faint">
          Reopen to fix a score
        </QuietButton>
      ) : null}

      {organiser ? (
        <BottomBar className="xl:ml-[max(0px,calc((100vw-72rem)/2))] xl:mr-auto xl:max-w-[34rem]">
          <div className="mb-2.5 flex justify-around">
            {copyAction}
            {csvAction}
            <BarAction
              wide
              icon={<Users />}
              label="Same players"
              href={`/new?${rematchQuery(tournament)}`}
            />
            <BarAction wide icon={<Home />} label="Home" href="/sessions" />
          </div>
          {onPlayAnother ? (
            <PrimaryButton onClick={onPlayAnother}>
              Play another {counterNoun(tournament).toLowerCase()}
              <RefreshCw />
            </PrimaryButton>
          ) : null}
        </BottomBar>
      ) : (
        // A viewer takes the results away and nothing else: no pinned bar,
        // because the spectator screen has its own footer under this.
        <div className="mt-5 flex justify-center gap-4">
          {copyAction}
          {csvAction}
        </div>
      )}

      {openRow && openSeries ? (
        <PlayerSpotlight
          tournament={tournament}
          row={openRow}
          series={openSeries}
          names={names}
          colors={colors}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}

interface PodiumPlace {
  key: string;
  place: number;
  name: string;
  face: ReactNode;
  /** the number on the block — points, or the place itself for a bracket */
  big: string;
  small: string;
  onOpen: () => void;
}

/** 2nd | 1st | 3rd, the blocks stepped 64 / 88 / 48 like a real podium. */
const BLOCK_HEIGHT: Record<number, string> = { 1: 'h-[88px]', 2: 'h-16', 3: 'h-12' };

function Podium({ places }: { places: PodiumPlace[] }) {
  const byPlace = (n: number) => places.find((p) => p.place === n);
  const order = [byPlace(2), byPlace(1), byPlace(3)].filter((p): p is PodiumPlace => Boolean(p));
  return (
    <ol className="mt-[18px] flex items-end gap-2.5">
      {order.map((p) => {
        const first = p.place === 1;
        return (
          <li key={p.key} className="min-w-0 flex-1">
            <button
              type="button"
              onClick={p.onOpen}
              aria-label={`${ordinal(p.place)}: ${p.name}`}
              className="flex w-full flex-col items-center gap-1.5 active:opacity-70"
            >
              {p.face}
              <span className="max-w-full truncate text-sm font-semibold">{p.name}</span>
              <span
                className={`flex w-full flex-col items-center justify-center rounded-[12px_12px_4px_4px] ${
                  BLOCK_HEIGHT[p.place] ?? 'h-12'
                } ${first ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink'}`}
              >
                <span className="nums text-xl font-semibold leading-tight">{p.big}</span>
                <span className="text-[11px] opacity-75">{p.small}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The awards nobody plays for, as a plain list.
 *
 * Every one is a number already on the board. The icons are the mock's — a
 * flat set in a tinted square — rather than the emoji the award data carries,
 * because eight different emoji faces at eight different weights is the one
 * place this screen used to stop looking like one design. Tapping an award
 * opens that player's night, same as tapping them anywhere else.
 */
const AWARD_ICONS: Record<string, ComponentType<{ size?: 'sm' | 'md' }>> = {
  metronome: Award,
  rollercoaster: Activity,
  climber: TrendingUp,
  faller: TrendingDown,
  streak: Flame,
  hammer: Zap,
  wall: Shield,
  iron: Timer,
};

function Awards({ awards, onOpen }: { awards: Superlative[]; onOpen: (id: Id) => void }) {
  return (
    <Group as="ul" className="mt-4">
      {awards.map((a, i) => {
        const Icon = AWARD_ICONS[a.key] ?? Award;
        return (
          <li key={a.key} className="rp-rise" style={{ animationDelay: `${i * 60}ms` }}>
            <button
              type="button"
              onClick={() => onOpen(a.playerId)}
              className="flex min-h-[58px] w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-2"
            >
              <span className="inline-flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] bg-accent-soft text-accent-text">
                <Icon />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-medium">{a.title}</span>
                <span className="text-xs text-ink-dim">
                  {a.name} — {a.detail}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </Group>
  );
}
