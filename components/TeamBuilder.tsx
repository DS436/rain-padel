'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Id, RosterEntry } from '@/lib/types';
import type { PlayerProfile } from '@/lib/players';
import { newTeamProfile, pairKey, type TeamProfile } from '@/lib/teams';
import { getPlayerStore } from '@/lib/store/playerStore';
import { getTeamStore } from '@/lib/store/teamStore';
import { PlayerAvatar, FALLBACK_COLOR } from '@/components/PlayerAvatar';
import { newId } from '@/lib/id';
import { defaultTeamName, type TeamInput } from '@/lib/tournamentReducer';

export interface DraftTeam {
  name?: string;
  players: [RosterEntry, RosterEntry];
  /** the saved pair this came from, or that it has since been saved as */
  savedId?: Id;
}

/**
 * Build the fixed pairs.
 *
 * Two names go in together and stay together, so this is deliberately not the
 * flat chip list individuals mode uses — a half-entered pair is not a valid
 * roster entry and the form should never let one exist.
 *
 * Most weeks the pairs are last week's pairs, which is what the saved list at
 * the top is for: one tap puts "Ana & Ben" back on the sheet, with both squad
 * links intact so the career record still joins up. Anything typed in fresh can
 * be starred once and is a tap away every week after that.
 */
export function TeamBuilder({
  teams,
  onChange,
}: {
  teams: DraftTeam[];
  onChange: (teams: DraftTeam[]) => void;
}) {
  const [a, setA] = useState<RosterEntry | null>(null);
  const [b, setB] = useState<RosterEntry | null>(null);
  const [saved, setSaved] = useState<TeamProfile[] | null>(null);
  const [squad, setSquad] = useState<PlayerProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getTeamStore().list(), getPlayerStore().list()])
      .then(([teamList, playerList]) => {
        if (cancelled) return;
        setSaved(teamList.filter((t) => !t.archived));
        setSquad(playerList.filter((p) => !p.archived));
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setSaved([]);
        setError(e instanceof Error ? e.message : 'Could not load the saved teams.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const inPlay = new Set(teams.map((t) => pairKey(t.players)));
  const canAdd = (a?.name.trim() ?? '') !== '' && (b?.name.trim() ?? '') !== '';

  /** Tapping a squad member drops them into whichever slot is still empty. */
  const fillSlot = (entry: RosterEntry) => {
    if (!a) setA(entry);
    else if (!b) setB(entry);
    else setA(entry); // both full — start the next pair with this person
  };

  const add = () => {
    if (!a || !b || !canAdd) return;
    const pair: [RosterEntry, RosterEntry] = [
      { ...a, name: a.name.trim() },
      { ...b, name: b.name.trim() },
    ];
    if (inPlay.has(pairKey(pair))) return;
    onChange([...teams, { players: pair, savedId: matchSaved(saved, pair)?.id }]);
    setA(null);
    setB(null);
  };

  const toggleSaved = (t: TeamProfile) => {
    const key = pairKey(t.players);
    onChange(
      inPlay.has(key)
        ? teams.filter((d) => pairKey(d.players) !== key)
        : [...teams, { name: t.name, players: t.players, savedId: t.id }],
    );
  };

  /** Star a pair that was typed in, so next week it is one tap. */
  async function saveForNextTime(draft: DraftTeam, index: number) {
    const profile = newTeamProfile(draft.players, { newId, now: Date.now }, draft.name);
    try {
      await getTeamStore().save(profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that team.');
      return;
    }
    setSaved((list) => [...(list ?? []), profile].sort((x, y) => x.name.localeCompare(y.name)));
    onChange(teams.map((t, i) => (i === index ? { ...t, savedId: profile.id } : t)));
  }

  async function forget(id: Id) {
    try {
      await getTeamStore().remove(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove that team.');
      return;
    }
    setSaved((list) => (list ?? []).filter((t) => t.id !== id));
    onChange(teams.map((t) => (t.savedId === id ? { ...t, savedId: undefined } : t)));
  }

  return (
    <div className="flex flex-col gap-4">
      {saved === null ? (
        <p className="text-sm text-ink-faint">Loading your saved teams…</p>
      ) : saved.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Saved teams
          </h3>
          <ul className="flex flex-wrap gap-2">
            {saved.map((t) => {
              const on = inPlay.has(pairKey(t.players));
              return (
                <li key={t.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => toggleSaved(t)}
                    aria-pressed={on}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-l-full border py-1 pl-1.5 pr-3 text-sm transition-colors ${
                      on
                        ? 'border-accent bg-accent/15 text-accent'
                        : 'border-line bg-surface text-ink-dim'
                    }`}
                  >
                    <span className="flex -space-x-1.5">
                      {t.players.map((p, i) => (
                        <PlayerAvatar
                          key={i}
                          name={p.name}
                          color={on ? undefined : FALLBACK_COLOR}
                          size="sm"
                        />
                      ))}
                    </span>
                    {t.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => void forget(t.id)}
                    aria-label={`Forget ${t.name}`}
                    className={`min-h-11 rounded-r-full border border-l-0 px-2.5 text-sm text-ink-faint active:bg-surface-2 ${
                      on ? 'border-accent' : 'border-line'
                    }`}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
        {squad.length > 0 ? (
          <>
            <p className="text-xs text-ink-faint">Tap two from the squad, or type the names.</p>
            <ul className="flex flex-wrap gap-1.5">
              {squad.map((p) => {
                const chosen = a?.profileId === p.id || b?.profileId === p.id;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => fillSlot({ name: p.name, profileId: p.id })}
                      aria-pressed={chosen}
                      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors ${
                        chosen
                          ? 'border-accent bg-accent/15 text-accent'
                          : 'border-line bg-ground text-ink-dim'
                      }`}
                    >
                      {p.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}

        <div className="flex items-center gap-2">
          <Slot
            value={a}
            placeholder="Player one"
            onChange={setA}
            onEnter={() => undefined}
          />
          <span className="shrink-0 text-sm text-ink-faint">&amp;</span>
          <Slot value={b} placeholder="Player two" onChange={setB} onEnter={add} />
        </div>

        <button
          type="button"
          onClick={add}
          disabled={!canAdd}
          className="min-h-11 rounded-lg bg-surface-2 text-sm font-medium text-ink disabled:text-ink-faint"
        >
          Add team
        </button>
      </section>

      {teams.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {teams.map((t, i) => (
            <li
              key={`${t.players[0].name}-${t.players[1].name}-${i}`}
              className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[15px]">
                  {t.name ?? defaultTeamName([t.players[0].name, t.players[1].name])}
                </span>
                <span className="text-xs text-ink-faint">Team {i + 1}</span>
              </span>

              <span className="flex shrink-0 items-center gap-1">
                {t.savedId ? (
                  <span
                    title="Saved for next time"
                    className="min-h-11 px-2 text-sm leading-[2.75rem] text-accent"
                  >
                    ★
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void saveForNextTime(t, i)}
                    className="min-h-11 rounded-lg px-2 text-sm text-ink-faint active:bg-surface-2"
                  >
                    ☆ Save
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onChange(teams.filter((_, j) => j !== i))}
                  aria-label={`Remove team ${i + 1}`}
                  className="min-h-11 min-w-11 rounded-lg text-lg text-ink-faint active:bg-surface-2"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-faint">
          Add both names together — a pair plays every game side by side. Star one to have it
          waiting next week, or{' '}
          <Link href="/players" className="text-accent underline underline-offset-4">
            save the regulars
          </Link>{' '}
          first and tap them in.
        </p>
      )}

      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}

/**
 * One side of a pair.
 *
 * A slot filled from the squad keeps its `profileId`, which is the whole point
 * — that link is what makes a teams night count towards a career record. Typing
 * over it drops the link, because the name no longer refers to that person.
 */
function Slot({
  value,
  placeholder,
  onChange,
  onEnter,
}: {
  value: RosterEntry | null;
  placeholder: string;
  onChange: (e: RosterEntry | null) => void;
  onEnter: () => void;
}) {
  return (
    <input
      value={value?.name ?? ''}
      onChange={(e) => onChange(e.target.value ? { name: e.target.value } : null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onEnter();
        }
      }}
      placeholder={placeholder}
      autoCapitalize="words"
      autoComplete="off"
      enterKeyHint="done"
      className={`min-h-11 min-w-0 flex-1 rounded-lg border bg-ground px-3 text-base text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none ${
        value?.profileId ? 'border-accent/50' : 'border-line'
      }`}
    />
  );
}

function matchSaved(
  saved: TeamProfile[] | null,
  players: [RosterEntry, RosterEntry],
): TeamProfile | undefined {
  const key = pairKey(players);
  return (saved ?? []).find((t) => pairKey(t.players) === key);
}

export function toTeamInputs(teams: DraftTeam[]): TeamInput[] {
  return teams.map((t) => ({ name: t.name, players: t.players }));
}
