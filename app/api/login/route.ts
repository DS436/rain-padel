import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * Password-only sign-in.
 *
 * The account still has an email — Supabase requires one, and the emailed-code
 * flow will need a deliverable address later. It just lives in a server-only
 * env var instead of the form, so the person running the night types a password
 * and nothing else, and the address never ships in the browser bundle.
 *
 * Password checking is still Supabase's: hashed, server-side, rate-limited.
 * Nothing here compares strings.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const email = process.env.LOGIN_EMAIL ?? '';

  if (!url || !key) {
    return NextResponse.json({ error: 'No database connected yet.' }, { status: 503 });
  }
  if (!email) {
    return NextResponse.json(
      { error: 'No account configured — set LOGIN_EMAIL in the environment.' },
      { status: 503 },
    );
  }

  let password = '';
  try {
    const body: unknown = await request.json();
    if (body && typeof body === 'object' && typeof (body as { password?: unknown }).password === 'string') {
      password = (body as { password: string }).password;
    }
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ error: 'Enter the password.' }, { status: 400 });
  }

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
