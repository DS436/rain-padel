"use client";

import { useState } from "react";
import type { Id, Tournament } from "@/lib/types";
import { Button } from "@/components/ui";
import { Sheet } from "@/components/Sheet";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { activeCount } from "@/lib/tournamentReducer";

/**
 * Mid-session roster changes (spec 9.5). Somebody always leaves early and
 * somebody always turns up late, and without this the organiser has to restart.
 */
export function RosterSheet({
  tournament,
  names,
  colors,
  onClose,
  onToggle,
  onToggleTeam,
  onAdd,
  onAddTeam,
}: {
  tournament: Tournament;
  names: Map<Id, string>;
  colors: Map<Id, string>;
  onClose: () => void;
  onToggle: (playerId: Id, active: boolean) => void;
  onToggleTeam: (teamId: Id, active: boolean) => void;
  onAdd: (name: string) => void;
  onAddTeam: (names: [string, string]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [pairA, setPairA] = useState("");
  const [pairB, setPairB] = useState("");
  const teams = tournament.mode === "teams";
  const active = activeCount(tournament);
  const activeTeams = tournament.teams.filter((t) => t.active).length;
  const atFloor = teams ? activeTeams <= 2 : active <= 4;

  if (teams) {
    return (
      <Sheet title="Teams" onClose={onClose}>
        <>
          <p className="mb-4 text-sm text-ink-dim">
            {activeTeams} team{activeTeams === 1 ? "" : "s"} playing
            {tournament.format === "americano"
              ? " · changing this rebuilds the games not yet played"
              : " · the next game uses whoever is playing"}
          </p>

          <ul className="mb-5 flex flex-col gap-2">
            {tournament.teams.map((team) => (
              <li
                key={team.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="flex -space-x-1.5">
                    {team.players.map((id) => (
                      <PlayerAvatar
                        key={id}
                        name={names.get(id) ?? "?"}
                        color={colors.get(id)}
                        size="sm"
                        dimmed={!team.active}
                      />
                    ))}
                  </span>
                  <span
                    className={`truncate ${team.active ? "text-ink" : "text-ink-faint line-through"}`}
                  >
                    {team.name}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onToggleTeam(team.id, !team.active)}
                  disabled={team.active && atFloor}
                  className="min-h-11 rounded-lg border border-line px-4 text-sm text-ink-dim active:bg-surface-2 disabled:opacity-40"
                >
                  {team.active ? "Mark as left" : "Bring back"}
                </button>
              </li>
            ))}
          </ul>

          {atFloor ? (
            <p className="mb-4 text-xs text-ink-faint">
              Two teams is the minimum for one court, so nobody else can drop
              out.
            </p>
          ) : null}

          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!pairA.trim() || !pairB.trim()) return;
              onAddTeam([pairA.trim(), pairB.trim()]);
              setPairA("");
              setPairB("");
            }}
          >
            <div className="flex items-center gap-2">
              <input
                value={pairA}
                onChange={(e) => setPairA(e.target.value)}
                placeholder="Player one"
                autoCapitalize="words"
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-base placeholder:text-ink-faint focus:border-accent focus:outline-none"
              />
              <span className="text-sm text-ink-faint">&amp;</span>
              <input
                value={pairB}
                onChange={(e) => setPairB(e.target.value)}
                placeholder="Player two"
                autoCapitalize="words"
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-base placeholder:text-ink-faint focus:border-accent focus:outline-none"
              />
            </div>
            <Button type="submit" disabled={!pairA.trim() || !pairB.trim()}>
              Add a team
            </Button>
          </form>
        </>
      </Sheet>
    );
  }

  return (
    <Sheet title="Players" onClose={onClose}>
      <>
        <p className="mb-4 text-sm text-ink-dim">
          {active} playing
          {tournament.format === "americano"
            ? " · changing this rebuilds the games not yet played"
            : " · the next game uses whoever is playing"}
        </p>

        <ul className="mb-5 flex flex-col gap-2">
          {tournament.players.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <PlayerAvatar
                  name={names.get(p.id) ?? p.name}
                  color={colors.get(p.id)}
                  size="sm"
                  dimmed={!p.active}
                />
                <span
                  className={`truncate ${p.active ? "text-ink" : "text-ink-faint line-through"}`}
                >
                  {names.get(p.id) ?? p.name}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onToggle(p.id, !p.active)}
                disabled={p.active && atFloor}
                className="min-h-11 rounded-lg border border-line px-4 text-sm text-ink-dim active:bg-surface-2 disabled:opacity-40"
              >
                {p.active ? "Mark as left" : "Bring back"}
              </button>
            </li>
          ))}
        </ul>

        {atFloor ? (
          <p className="mb-4 text-xs text-ink-faint">
            Four players is the minimum for one court, so nobody else can drop
            out.
          </p>
        ) : null}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            onAdd(draft);
            setDraft("");
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Someone just arrived…"
            autoCapitalize="words"
            className="min-h-11 flex-1 rounded-xl border border-line bg-surface px-4 text-base placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          <Button type="submit" disabled={!draft.trim()}>
            Add
          </Button>
        </form>
      </>
    </Sheet>
  );
}
