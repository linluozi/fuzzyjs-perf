export type ScoreComputer = (source: string) => number;

/**
 * Memoizes a `source -> score` computation.
 *
 * `undefined` is the only marker for "not computed yet". A score of `0` is a
 * perfectly legitimate result — it is what `match` returns for a source that
 * does not match at all, and also for a match whose increments are cancelled
 * out by the `-1` penalty of the characters around it — so it must be cached
 * like any other value. Testing the cached value for truthiness instead made
 * every zero-score source be recomputed on every comparison; since a filter
 * usually leaves most sources unmatched, that is the common case, not the edge
 * case.
 */
export function createScoreCache(compute: ScoreComputer): ScoreComputer {
  const cache: Map<string, number> = new Map();

  return function score(source: string): number {
    const cached = cache.get(source);

    if (cached !== undefined) {
      return cached;
    }

    const computed = compute(source);

    cache.set(source, computed);

    return computed;
  };
}
