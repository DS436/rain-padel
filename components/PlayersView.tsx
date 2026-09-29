'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Id, Tournament } from '@/lib/types';
import type { CareerStats, PlayerProfile } from '@/lib/players';
import type { TeamProfile } from '@/lib/teams';
import { careerStats, rankSquad } from '@/lib/players';
import { teamProfileName } from '@/lib/teams';
import { getPlayerStore } from '@/lib/store/playerStore';
import { getTeamStore } from '@/lib/store/teamStore';
import { getStore } from '@/lib/store/factory';
import { newId } from '@/lib/id';
import {
  Group,
  GroupLabel,
  ListRow,
  PageTitle,
  QuietButton,
  Segmented,
  SecondaryButton,
  TopBar,
} from '@/components/ui';
import { DevStoreBanner } from '@/components/DevStoreBanner';
import { AvatarStack, PlayerAvatar, colorAt } from '@/components/PlayerAvatar';
import { ChevronDown, CrownIcon, Search, UserPlus } from '@/components/icons';
import { Sheet } from '@/components/Sheet';
import { NameField, ProfileSheet } from '@/components/ProfileSheet';

/**
 * What the squad is ranked on.
 *
 * These are the four the app can actually answer from stored sessions. The
 * mock shows no sort control at all; it survives as a quiet dropdown over the
 * list, because "who has played most" is a question the group does ask.
 */
const SORTS = [
  { key: 'average', label: 'Per game' },
  { key: 'sessions', label: 'Nights' },
  { key: 'titles', label: 'Wins' },
  { key: 'points', label: 'Points' },
] as const;

type SortKey = (typeof SORTS)[number]['key'];

type View = 'people' | 'pairs';

/**
 * A face colour for everyone in the squad.
 *
 * Session colours are handed out by roster position, which is right for a
 * night and useless across nights — Ana is red on Tuesday and teal on
 * Thursday. The squad is ordered by when each person was saved, which never
 * changes, so walking the same palette in that order gives each regular one
 * colour they keep on every squad-level screen (this one and the home page).
 */
export function squadColors(profiles: readonly PlayerProfile[]): Map<Id, string> {
  const ordered = [...profiles].sort(
    (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
  );
  return new Map(ordered.map((p, i) => [p.id, colorAt(i)] as const));
}

/** "14 nights · 9.4 per game · 5 wins" — wins are nights won, as on the home page. */
function careerLine(c: CareerStats, sort: SortKey): string {
  if (c.sessions === 0) return 'No nights yet';
  const parts = [
    `${c.sessions} night${c.sessions === 1 ? '' : 's'}`,
    `${c.average.toFixed(1)} per game`,
  ];
  if (c.titles > 0) parts.push(`${c.titles} win${c.titles === 1 ? '' : 's'}`);
  // Sorting by points would otherwise order the list by a number it hides.
  if (sort === 'points') parts.push(`${c.points} pts`);
  return parts.join(' · ');
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The squad — one saved list of people, shared by every session.
 *
 * This is the part that makes a season out of a set of nights. A name typed
 * into one session dies with it; a saved player accumulates, so "who is
 * actually the best of us" stops being an argument and becomes a column.
 *
 * Career numbers are folded out of the sessions themselves rather than kept in
 * a counter, for the same reason standings are: a score corrected three weeks
 * later has to move the record, and derived-every-time is the only version of
 * that which cannot go stale.
 *
 * The saved pairs live here too, behind People / Pairs. They are made while
 * setting up a teams night (`TeamBuilder`), so this tab only tidies them —
 * rename, hide, remove — and the add button always adds a person.
 */
export function PlayersView() {
  const [squad, setSquad] = useState<PlayerProfile[] | null>(null);
  const [pairs, setPairs] = useState<TeamProfile[]>([]);
  const [sessions, setSessions] = useState<Tournament[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [openPair, setOpenPair] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('average');
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<View>('people');
  const [query, setQuery] = useState('');
  /** bumping this re-runs the load effect; avoids setState during render */
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getPlayerStore().list(), getStore().listAll(), getTeamStore().list()])
      .then(([list, all, teams]) => {
        if (cancelled) return;
        setSquad(list);
        setSessions(all);
        setPairs(teams);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setSquad((s) => s ?? []);
        setError(e instanceof Error ? e.message : 'Could not load the squad.');
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const load = () => setReloadToken((n) => n + 1);

  const stats = useMemo(() => careerStats(squad ?? [], sessions), [squad, sessions]);
  const colors = useMemo(() => squadColors(squad ?? []), [squad]);
  const ranked = useMemo(() => {
    const base = rankSquad(squad ?? [], stats);
    if (sort === 'average') return base;
    // Archived players stay at the bottom whichever column is driving.
    return [...base].sort(
      (a, b) =>
        Number(a.profile.archived) - Number(b.profile.archived) ||
        b.stats[sort] - a.stats[sort] ||
        b.stats.average - a.stats.average ||
        a.profile.name.localeCompare(b.profile.name),
    );
  }, [squad, stats, sort]);

  const needle = query.trim().toLowerCase();
  const shownPeople = needle
    ? ranked.filter(({ profile }) => profile.name.toLowerCase().includes(needle))
    : ranked;
  const shownPairs = (
    needle
      ? pairs.filter(
          (t) =>
            t.name.toLowerCase().includes(needle) ||
            t.players.some((p) => p.name.toLowerCase().includes(needle)),
        )
      : pairs
  )
    .slice()
    .sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name));

  const activePeople = (squad ?? []).filter((p) => !p.archived).length;
  const activePairs = pairs.filter((t) => !t.archived).length;
  // Only offer the Pairs tab when there is something behind it; an empty tab
  // is worse than one fewer tab.
  const showPairs = pairs.length > 0;
  const current: View = showPairs ? view : 'people';

  async function add() {
    const name = draft.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      await getPlayerStore().save({ id: newId(), name, createdAt: Date.now(), archived: false });
      setDraft('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that player.');
    } finally {
      setBusy(false);
    }
  }

  async function update(profile: PlayerProfile) {
    try {
      await getPlayerStore().save(profile);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update that player.');
    }
  }

  async function remove(profile: PlayerProfile) {
    if (
      !window.confirm(
        `Remove ${profile.name} from the squad? Sessions they played in keep their scores.`,
      )
    ) {
      return;
    }
    try {
      await getPlayerStore().remove(profile.id);
      setOpen(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove that player.');
    }
  }

  async function updatePair(team: TeamProfile) {
    try {
      await getTeamStore().save(team);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update that pair.');
    }
  }

  async function removePair(team: TeamProfile) {
    if (
      !window.confirm(`Remove the saved pair ${team.name}? Nights they played keep their scores.`)
    ) {
      return;
    }
    try {
      await getTeamStore().remove(team.id);
      setOpenPair(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove that pair.');
    }
  }

  const openProfile = open ? (squad ?? []).find((p) => p.id === open) : null;
  const openTeam = openPair ? pairs.find((t) => t.id === openPair) : null;
  const leaderId =
    sort === 'average' && ranked[0] && !ranked[0].profile.archived && ranked[0].stats.games > 0
      ? ranked[0].profile.id
      : null;

  return (
    <>
      <DevStoreBanner />
      <main className="mx-auto flex w-full max-w-lg flex-col pb-16">
        <TopBar
          back={{ href: '/sessions', label: 'Home' }}
          right={
            <button
              type="button"
              onClick={() => {
                setView('people');
                setAdding((a) => !a);
              }}
              aria-expanded={adding}
              aria-label="Add someone to the squad"
              className="inline-flex h-11 w-11 flex-none items-center justify-center text-accent-text active:opacity-60"
            >
              <UserPlus className="h-[22px] w-[22px]" />
            </button>
          }
        />
        <PageTitle
          sub={
            squad === null
              ? ' '
              : [
                  plural(activePeople, 'person', 'people'),
                  activePairs > 0 ? plural(activePairs, 'saved pair', 'saved pairs') : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
          }
        >
          Squad
        </PageTitle>

        <div className="px-6">
          {showPairs ? (
            <div className="mt-4">
              <Segmented
                value={current}
                onChange={setView}
                options={[
                  { value: 'people', label: 'People' },
                  { value: 'pairs', label: 'Pairs' },
                ]}
              />
            </div>
          ) : null}

          {adding && current === 'people' ? (
            <form
              className="card mt-3 flex h-[52px] items-center gap-2 pl-4 pr-1"
              onSubmit={(e) => {
                e.preventDefault();
                void add();
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Their name"
                aria-label="Name of the person to add"
                autoCapitalize="words"
                autoComplete="off"
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-[15px] placeholder:text-ink-faint focus:outline-none"
              />
              <button
                type="submit"
                disabled={!draft.trim() || busy}
                className="inline-flex min-h-11 items-center px-3 text-[15px] font-semibold text-accent-text disabled:text-ink-faint"
              >
                Add
              </button>
            </form>
          ) : null}

          <label className="card mt-3 flex h-11 items-center gap-2 px-3.5 text-ink-faint">
            <Search />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label={current === 'pairs' ? 'Search saved pairs' : 'Search the squad'}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-faint focus:outline-none"
            />
          </label>

          {error ? <p className="mt-3 px-1 text-[13px] text-danger">{error}</p> : null}

          {current === 'pairs' ? (
            <PairList
              pairs={shownPairs}
              colors={colors}
              searching={needle !== ''}
              onOpen={setOpenPair}
            />
          ) : squad === null ? (
            <p className="mt-6 px-1 text-sm text-ink-faint">Loading…</p>
          ) : ranked.length === 0 ? (
            <p className="card mt-3 px-5 py-6 text-center text-sm leading-relaxed text-ink-dim">
              Nobody saved yet. Add the people you play with most and you will never type their
              names again.
            </p>
          ) : (
            <>
              <GroupLabel
                className="!mb-1 !mt-3"
                aside={
                  <label className="-mr-1 inline-flex min-h-11 items-center gap-1 px-1 font-medium text-ink-dim">
                    <span className="sr-only">Sort by</span>
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value as SortKey)}
                      className="appearance-none bg-transparent pr-0.5 text-right focus:outline-none"
                    >
                      {SORTS.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size="sm" />
                  </label>
                }
              >
                {needle ? plural(shownPeople.length, 'match', 'matches') : 'Sorted by'}
              </GroupLabel>
              {shownPeople.length === 0 ? (
                <p className="px-1 py-4 text-sm text-ink-faint">Nobody by that name.</p>
              ) : (
                <Group as="ul">
                  {shownPeople.map(({ profile, stats: c }) => (
                    <li key={profile.id}>
                      <ListRow
                        onClick={() => setOpen(profile.id)}
                        minH="min-h-[58px]"
                        className={profile.archived ? 'opacity-60' : ''}
                        lead={
                          <PlayerAvatar
                            name={profile.name}
                            color={colors.get(profile.id)}
                            size="row"
                            dimmed={profile.archived}
                          />
                        }
                        title={
                          <>
                            {profile.name}
                            {profile.id === leaderId ? (
                              <CrownIcon className="ml-1.5 inline h-3.5 w-3.5 align-[-2px]" />
                            ) : null}
                          </>
                        }
                        sub={
                          profile.archived
                            ? `Hidden from the picker · ${careerLine(c, sort)}`
                            : careerLine(c, sort)
                        }
                        chevron
                      />
                    </li>
                  ))}
                </Group>
              )}
            </>
          )}

          <p className="mt-4 px-1 text-[13px] leading-relaxed text-ink-faint">
            {current === 'pairs'
              ? 'Pairs are saved while you set up a teams night. Pick one next week and both players come with it.'
              : 'Save the regulars once — they are one tap away when you set up a night, and every session they play folds into the record.'}
          </p>
        </div>
      </main>

      {openProfile ? (
        <ProfileSheet
          profile={openProfile}
          color={colors.get(openProfile.id)}
          stats={stats.get(openProfile.id)}
          onClose={() => setOpen(null)}
          onUpdate={(p) => void update(p)}
          onRemove={() => void remove(openProfile)}
        />
      ) : null}

      {openTeam ? (
        <PairSheet
          team={openTeam}
          onClose={() => setOpenPair(null)}
          onUpdate={(t) => void updatePair(t)}
          onRemove={() => void removePair(openTeam)}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Pairs
 * ------------------------------------------------------------------ */

function PairList({
  pairs,
  colors,
  searching,
  onOpen,
}: {
  pairs: TeamProfile[];
  colors: Map<Id, string>;
  searching: boolean;
  onOpen: (id: string) => void;
}) {
  if (pairs.length === 0) {
    return (
      <p className="px-1 py-4 text-sm text-ink-faint">
        {searching ? 'No pair by that name.' : 'No saved pairs.'}
      </p>
    );
  }
  return (
    <Group as="ul" className="mt-3">
      {pairs.map((t) => {
        const named = t.name !== teamProfileName(t.players);
        return (
          <li key={t.id}>
            <ListRow
              onClick={() => onOpen(t.id)}
              minH="min-h-[58px]"
              className={t.archived ? 'opacity-60' : ''}
              lead={
                <AvatarStack
                  size="md"
                  people={t.players.map((p) => ({
                    name: p.name,
                    color: p.profileId ? colors.get(p.profileId) : undefined,
                  }))}
                />
              }
              title={t.name}
              sub={[
                named ? teamProfileName(t.players) : null,
                t.archived ? 'Hidden from the picker' : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              chevron
            />
          </li>
        );
      })}
    </Group>
  );
}

function PairSheet({
  team,
  onClose,
  onUpdate,
  onRemove,
}: {
  team: TeamProfile;
  onClose: () => void;
  onUpdate: (t: TeamProfile) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(team.name);
  return (
    <Sheet title={team.name} description={teamProfileName(team.players)} onClose={onClose}>
      <div className="flex flex-col gap-5 pb-2">
        <NameField
          value={name}
          onChange={setName}
          // An emptied name falls back to "Ana & Ben" rather than saving blank.
          canSave={teamProfileName(team.players, name) !== team.name}
          onSave={() => onUpdate({ ...team, name: teamProfileName(team.players, name) })}
        />
        <div className="flex flex-col gap-1">
          <SecondaryButton onClick={() => onUpdate({ ...team, archived: !team.archived })}>
            {team.archived ? 'Bring back into the picker' : 'Hide from the picker'}
          </SecondaryButton>
          <QuietButton className="!text-danger" onClick={onRemove}>
            Remove this pair
          </QuietButton>
        </div>
      </div>
    </Sheet>
  );
}
