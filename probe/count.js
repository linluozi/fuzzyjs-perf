/**
 * Counts how many times `match()` is entered during one `sort()` pass.
 *
 * Both builds are the pristine source plus a single counter increment at the
 * top of `match()`, so the numbers are directly comparable:
 *
 *   node probe/count.js probe/.build/out-instr            # baseline
 *   node probe/count.js probe/.build/out-instr-candidate  # patched
 */
const path = require("path");

const outDir = process.argv[2] || "probe/.build/out-instr";
const { sort } = require(path.resolve(outDir, "array"));

/** Deterministic shuffle so that TimSort cannot short-circuit on a sorted run. */
function shuffle(items, seed = 20261017) {
  const out = items.slice();
  let state = seed;
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (state * 1103515245 + 12345) % 2147483648;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const records = [];

function run(label, query, items) {
  globalThis.__matchCalls = 0;
  const input = shuffle(items);
  input.sort(sort(query, { iterator: (item) => item }));
  const distinct = new Set(items).size;
  const calls = globalThis.__matchCalls;
  records.push({ label, query, n: items.length, distinct, calls });
  console.log(
    [
      label.padEnd(42),
      `n=${String(items.length).padStart(5)}`,
      `distinct=${String(distinct).padStart(5)}`,
      `match()=${String(calls).padStart(6)}`,
      `per distinct=${(calls / distinct).toFixed(2)}`,
    ].join("  ")
  );
}

const cities = require("../benchmark/cities.json").map((city) => city.city);
run("cities 'ah' (many zero scores)", "ah", cities);
run("cities 'a'", "a", cities);
run("cities 'zzz' (all zero scores)", "zzz", cities);
run("cities 'new york'", "new york", cities);

const dupes = Array.from({ length: 1000 }, (_, i) => `Zulu-${String(i % 10).padStart(2, "0")}`);
run("1000 items / 10 distinct, all zero", "zzqq", dupes);

const matching = Array.from({ length: 1000 }, (_, i) => `Alpha-${String(i).padStart(4, "0")}`);
run("1000 distinct, all matching", "alp", matching);

// "A" is leading (+10); the ten following characters give -1 each => score 0
// even though the query matched.
const zeroMatch = Array.from({ length: 1000 }, (_, i) => `A${String(i).padStart(10, "0")}`);
run("1000 distinct, score exactly 0", "a", zeroMatch);

// Machine-readable output, so the charts are drawn from numbers instead of
// retyped into a script.
const outFile = process.env.COUNT_OUT;
if (outFile) {
  const fs = require("fs");
  const implementation = outDir.includes("candidate") ? "patched" : "head";
  fs.writeFileSync(
    outFile,
    JSON.stringify({ implementation, records }, null, 2) + "\n"
  );
  console.log(`\nwrote ${outFile}`);
}
