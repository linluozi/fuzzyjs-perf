/**
 * Copies a source tree and adds a single counter increment at the top of
 * `match()`, so that `probe/count.js` can report how many times the scorer is
 * entered during one sort. Nothing else is touched: the two builds differ by
 * exactly that line plus the patches under test.
 *
 *   node probe/make-instrumented.mjs baseline/src probe/.build/instrumented
 */
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [, , from, to] = process.argv;

if (!from || !to) {
  console.error("usage: node probe/make-instrumented.mjs <srcDir> <outDir>");
  process.exit(2);
}

mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true });

const matchFile = path.join(to, "match.ts");
const source = readFileSync(matchFile, "utf8");
const anchor = "  const [reshapedQuery, reshapedSource] = reshapeInput(query, source, opts);";

if (!source.includes(anchor)) {
  console.error(`could not find the instrumentation anchor in ${matchFile}`);
  process.exit(1);
}

writeFileSync(
  matchFile,
  source.replace(
    anchor,
    [
      "  (globalThis as any).__matchCalls =",
      "    ((globalThis as any).__matchCalls || 0) + 1;",
      anchor,
    ].join("\n")
  )
);

console.log(`instrumented ${from} -> ${to}`);
