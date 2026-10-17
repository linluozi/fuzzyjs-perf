import { TestOptions } from "../test";

/** Any character outside 7-bit ASCII. */
const NON_ASCII = /[^\x00-\x7f]/;

/** Combining diacritical marks, stripped after the NFD decomposition. */
const COMBINING_MARKS = /[\u0300-\u036f]/g;

/**
 * Removes accents from a string.
 *
 * `normalize("NFD")` and the mark-stripping replace are both identity on pure
 * ASCII — no ASCII character has a decomposition — so testing for ASCII first
 * skips two full passes (and two allocations) on the most common input.
 *
 * @param str The input string
 * @returns The input string without accents
 */
function stripAccents(str: string): string {
  if (!NON_ASCII.test(str)) {
    return str;
  }

  return str.normalize("NFD").replace(COMBINING_MARKS, "");
}

/**
 * This functions is used to throw when query or source is not defined as well
 * as normalizing and lower casing the input strings.
 *
 * @param query The fuzzy query string
 * @param source The fuzzy source string
 * @param opts An options object that can contains `caseSensitive`
 * @returns The reshaped query string and the reshaped source string.
 */
export function reshapeInput(
  query: string,
  source: string,
  opts: TestOptions
): [string, string] {
  if (typeof query !== "string") {
    throw new TypeError("Expecting query to be a string");
  }

  if (typeof source !== "string") {
    throw new TypeError("Expecting source to be a string");
  }

  let reshapedQuery = stripAccents(query);
  let reshapedSource = stripAccents(source);

  if (!opts.caseSensitive) {
    reshapedQuery = reshapedQuery.toLowerCase();
    reshapedSource = reshapedSource.toLowerCase();
  }

  return [reshapedQuery, reshapedSource];
}
