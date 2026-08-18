'use client';

import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { Id, Tournament } from '@/lib/types';
import { newId } from '@/lib/id';
import { getStore } from '@/lib/store/factory';
import {
  createReducer,
  initialState,
  type Action,
  type Notice,
} from '@/lib/tournamentReducer';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface Ctx {
  tournament: Tournament;
  dispatch: Dispatch<Action>;
  notice: Notice | null;
  saveState: SaveState;
  retrySave: () => void;
}

const TournamentContext = createContext<Ctx | null>(null);

export function useTournament(): Ctx {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error('useTournament must be used inside a TournamentProvider');
  return ctx;
}

/** Writes are coalesced: a drag on the score slider must not be one POST per frame. */
const SAVE_DEBOUNCE_MS = 400;

export function TournamentProvider({ id, children }: { id: Id; children: ReactNode }) {
  const reducer = useMemo(() => createReducer({ newId, now: Date.now }), []);
  const [state, dispatch] = useReducer(reducer, initialState);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);

  const pending = useRef<Tournament | null>(null);
  const lastSaved = useRef<string | null>(null);
  const timer = useRef<number | null>(null);

  // The page keys this provider by id, so a different tournament remounts and
  // `status` starts at 'loading' again — no synchronous setState needed here.
  useEffect(() => {
    let cancelled = false;
    getStore()
      .get(id)
      .then((t) => {
        if (cancelled) return;
        if (!t) {
          setStatus('missing');
          return;
        }
        lastSaved.current = JSON.stringify(t);
        dispatch({ type: 'HYDRATE', tournament: t });
        setStatus('ready');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : 'Could not reach the database.');
        setStatus('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const flush = useCallback(async () => {
    const t = pending.current;
    if (!t) return;
    pending.current = null;
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setSaveState('saving');
    try {
      await getStore().save(t);
      lastSaved.current = JSON.stringify(t);
      setSaveState('saved');
    } catch {
      pending.current = t; // keep it so retry and pagehide can try again
      setSaveState('error');
    }
  }, []);

  // Queue a save whenever the tournament actually changes.
  useEffect(() => {
    const t = state.tournament;
    if (!t || status !== 'ready') return;
    const serialized = JSON.stringify(t);
    if (serialized === lastSaved.current) return;

    pending.current = t;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);

    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [state.tournament, status, flush]);

  // The phone-lock case: get the pending write out before the tab is frozen.
  useEffect(() => {
    const onHide = () => {
      if (pending.current) void flush();
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') onHide();
    });
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [flush]);

  const tournament = state.tournament;

  if (status === 'loading') return <Centered>Loading…</Centered>;
  if (status === 'missing') {
    return (
      <Centered>
        <p className="text-ink-dim">That session no longer exists.</p>
        <Link href="/sessions" className="mt-4 inline-block text-accent underline underline-offset-4">
          Back to sessions
        </Link>
      </Centered>
    );
  }
  if (status === 'failed' || !tournament) {
    return (
      <Centered>
        <p className="text-danger">{loadError ?? 'Something went wrong.'}</p>
        <Link href="/sessions" className="mt-4 inline-block text-accent underline underline-offset-4">
          Back to sessions
        </Link>
      </Centered>
    );
  }

  // Built after the early returns rather than memoised: the provider only
  // re-renders when something a consumer actually cares about has changed.
  const value: Ctx = {
    tournament,
    dispatch,
    notice: state.notice,
    saveState,
    retrySave: () => void flush(),
  };

  return <TournamentContext.Provider value={value}>{children}</TournamentContext.Provider>;
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">{children}</div>
  );
}
