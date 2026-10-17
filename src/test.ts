import { reshapeInput } from "./utils/prepare";

/**
 * This represents test options. You can specify if the source string should be
 * lower cased or not (wether you want the test to be case-sensitive or not).
 */
export interface TestOptions {
  caseSensitive?: boolean;
}

/**
 * Returns wether or not the query fuzzy matches the source. This will returns
 * a boolean.
 *
 * @param query The input query
 * @param source The input source
 * @param opts Options as defined by [[TestOptions]]
 * @returns Wether or not the query fuzzy matches the source
 */
export function test(
  query: string,
  source: string,
  opts: TestOptions = {}
): boolean {
  const [reshapedQuery, reshapedSource] = reshapeInput(query, source, opts);

  // if no source, then only return true if query is also empty
  if (!reshapedSource.length) {
    return !query.length;
  }

  if (!reshapedQuery.length) {
    return true;
  }

  // a bigger query than source will always return false
  if (reshapedQuery.length > reshapedSource.length) {
    return false;
  }

  let queryPos = 0;
  let sourcePos = 0;

  // The loop below walks `source` by index but reads `reshapedSource`, which
  // is shorter when the input contains explicit combining marks (a decomposed
  // "café" becomes "cafe"). In that ragged case the original loop relies on
  // `undefined === undefined` and can end up counting one extra match, so the
  // early return is only taken when both lengths agree — that keeps the
  // observable result byte-identical.
  const canStopEarly = reshapedSource.length === source.length;

  // loop on source string
  while (sourcePos < source.length) {
    const actualSourceCharacter = reshapedSource[sourcePos];
    const queryCharacterWaitingForMatch = reshapedQuery[queryPos];

    // if actual query character matches source character
    if (actualSourceCharacter === queryCharacterWaitingForMatch) {
      // move query pos
      queryPos += 1;

      // every query character has been matched: the remaining characters
      // cannot change the answer, so there is no point walking them
      if (canStopEarly && queryPos === reshapedQuery.length) {
        return true;
      }
    }

    sourcePos += 1;
  }

  return queryPos === reshapedQuery.length;
}
