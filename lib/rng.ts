/**
 * Deterministic pseudo-randomness.
 *
 * Spec 7.4 asks for a "seeded random" tiebreak when choosing who rests. It has
 * to be seeded rather than Math.random for two reasons: the schedule must be
 * reproducible from stored state (nothing about a round is persisted beyond its
 * result), and the tests need to assert on it.
 */

/** FNV-1a, 32-bit. Cheap string -> seed. */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, good enough for breaking sort ties. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable across reloads: same tournament + same round always gives the same stream. */
export function seededRng(...parts: (string | number)[]): () => number {
  return mulberry32(fnv1a(parts.join(':')));
}
