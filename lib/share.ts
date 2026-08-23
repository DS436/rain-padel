import type { ShareAccess } from '@/lib/types';

/**
 * Read-only sharing.
 *
 * The point is a code you can read out over the noise of a padel court, so the
 * alphabet drops every character that gets misheard or mistyped: no O or 0, no
 * I, L or 1, no U (heard as "you"), no S/5 confusion. Six characters out of a
 * 26-symbol alphabet is about 300 million codes, which is far more than a table
 * of padel nights between friends will ever need to keep apart.
 *
 * This is NOT a security boundary and is not pretending to be one. Anyone with
 * the anon key can list the SHARED sessions without knowing their codes — see
 * `0005_share_read.sql`. What a code buys is that a link handed to the group
 * chat opens a screen with no edit controls on it, that the link is not
 * guessable from the session name, and that revoking it takes the session back
 * out of anon's reach entirely.
 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRTVWXY';
const LENGTH = 6;

export function generateShareCode(): string {
  const bytes = new Uint8Array(LENGTH);
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes);
  else for (let i = 0; i < LENGTH; i++) bytes[i] = Math.floor(Math.random() * 256);

  let out = '';
  for (let i = 0; i < LENGTH; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

export function newShare(now: number): ShareAccess {
  return { code: generateShareCode(), createdAt: now };
}

/**
 * Accept what people actually type: lower case, the dash from the printed
 * form, stray spaces. Anything left over that is not in the alphabet makes the
 * code invalid rather than being silently dropped, so a typo fails loudly.
 */
export function normaliseShareCode(raw: string): string | null {
  const cleaned = raw.trim().toUpperCase().replace(/[\s-]+/g, '');
  if (cleaned.length !== LENGTH) return null;
  for (const ch of cleaned) if (!ALPHABET.includes(ch)) return null;
  return cleaned;
}

/** "K7M-4QD" reads back more reliably than "K7M4QD". */
export function formatShareCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

/** The path a spectator opens. Absolute URL is built at the call site. */
export function sharePath(code: string): string {
  return `/s/${code}`;
}
