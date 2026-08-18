'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '@/components/AuthProvider';

/**
 * Wraps the pages that need a signed-in user.
 *
 * This is a convenience redirect, not the security boundary — that is row-level
 * security in Postgres, which refuses to hand out data without a valid token no
 * matter what the client believes.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading, devMode } = useAuth();
  const router = useRouter();
  const allowed = devMode || session !== null;

  useEffect(() => {
    if (!loading && !allowed) router.replace('/login');
  }, [loading, allowed, router]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-ink-faint">Loading…</div>
    );
  }
  if (!allowed) return null;

  return <>{children}</>;
}
