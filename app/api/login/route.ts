import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { parseAccounts, pickAccount } from '@/lib/accounts';

/**
 * Name-and-password sign-in.
 *
 * Each account still has an email — Supabase requires one, and the emailed-code
 * flow will need a deliverable address later. It just lives in a server-only
 * env var instead of the form (see `lib/accounts.ts`), so the person running
 * the night taps their name and types a password, and no address ever ships in
 * the browser bundle.
 *
 * Password checking is still Supabase's: hashed, server-side, rate-limited.
 * Nothing here compares strings.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const accounts = () => parseAccounts(process.env.LOGIN_ACCOUNTS, process.env.LOGIN_EMAIL);

/** The names for the picker. Never the addresses. */
export async function GET() {
  return NextResponse.json({ accounts: accounts().map((a) => a.name) });
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const configured = accounts();

  if (!url || !key) {
    return NextResponse.json({ error: 'No database connected yet.' }, { status: 503 });
  }
  if (configured.length === 0) {
    return NextResponse.json(
      { error: 'No account configured — set LOGIN_ACCOUNTS in the environment.' },
      { status: 503 },
    );
  }

  let password = '';
  let name: string | undefined;
  try {
    const body: unknown = await request.json();
    if (body && typeof body === 'object') {
      const b = body as { password?: unknown; account?: unknown };
      if (typeof b.password === 'string') password = b.password;
      if (typeof b.account === 'string') name = b.account;
    }
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
  const account = pickAccount(configured, name);
  if (!account) {
    return NextResponse.json({ error: 'Pick who is signing in.' }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ error: 'Enter the password.' }, { status: 400 });
  }
  const { email } = account;

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    // Deliberately vague, and never echoes the configured address.
    const tooMany = /rate limit|too many/i.test(error?.message ?? '');
    return NextResponse.json(
      { error: tooMany ? 'Too many attempts — wait a minute.' : 'Wrong password.' },
      { status: tooMany ? 429 : 401 },
    );
  }

  return NextResponse.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}
