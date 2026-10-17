/**
 * Exhaustive equivalence check for the `isLeading` fast path.
 * Compares the new implementation with the original expression on every code
 * point of Unicode (including surrogate halves, which is what `source[pos]`
 * yields for astral characters) and on the separator prefixes.
 */
const { isLeading } = require("./.build/out/isLeading");

const PREV = ["", "a", "A", "-", "_", " ", ".", "/", "\\", "0", "中", "\u0301"];

function original(prevChar, char) {
  const precededBySeparator =
    prevChar === "-" ||
    prevChar === "_" ||
    prevChar === " " ||
    prevChar === "." ||
    prevChar === "/" ||
    prevChar === "\\";
  const toLatin = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const isCharLeading = char.toUpperCase() === char && /\w/.test(toLatin(char));
  return precededBySeparator || isCharLeading;
}

let checked = 0;
let mismatches = 0;
for (let code = 0; code <= 0x10ffff; code += 1) {
  const char = String.fromCodePoint(code);
  for (const prev of PREV) {
    const expected = original(prev, char);
    const actual = isLeading(prev, char);
    checked += 1;
    if (expected !== actual) {
      mismatches += 1;
      if (mismatches <= 10) {
        console.log(
          `MISMATCH prev=${JSON.stringify(prev)} char=U+${code.toString(16).padStart(4, "0")} original=${expected} new=${actual}`
        );
      }
    }
  }
}

// Also check the exact code units that `source[pos]` produces for astral chars.
for (let code = 0xd800; code <= 0xdfff; code += 1) {
  const char = String.fromCharCode(code);
  for (const prev of PREV) {
    if (original(prev, char) !== isLeading(prev, char)) {
      mismatches += 1;
    }
  }
}

console.log(`checked ${checked} (prev, char) pairs, ${mismatches} mismatch(es)`);
process.exit(mismatches === 0 ? 0 : 1);
