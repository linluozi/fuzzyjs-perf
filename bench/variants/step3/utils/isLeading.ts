import { toLatin } from "./toLatin";

/**
 * Returns true when the character is leading; ie. when it's a capital or
 * when it's following a separator character. You might also want to test if
 * the character comes from an alphabet as you wouldn't want to consider a
 * space as a leading character.
 *
 * @param prevChar The character that appears before `char`
 * @param char The actual character you want to test
 * @returns Wether or not the character is leading
 */
export function isLeading(prevChar: string, char: string): boolean {
  const precededBySeparator =
    prevChar === "-" ||
    prevChar === "_" ||
    prevChar === " " ||
    prevChar === "." ||
    prevChar === "/" ||
    prevChar === "\\";

  if (precededBySeparator) {
    return true;
  }

  const code = char.charCodeAt(0);

  // Fast path for ASCII. `toLatin` is the identity on ASCII (no ASCII
  // character lives in the combining diacritical block) and `/\w/` is exactly
  // `[A-Za-z0-9_]`, so `char.toUpperCase() === char && /\w/.test(toLatin(char))`
  // reduces to "A-Z, 0-9 or _". This is the branch that runs for every
  // character of every ASCII source, and it used to pay for a `normalize()`
  // plus a regex allocation each time.
  if (code < 128) {
    return (code >= 65 && code <= 90) || (code >= 48 && code <= 57) || code === 95;
  }

  return char.toUpperCase() === char && /\w/.test(toLatin(char));
}
