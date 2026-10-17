/**
 * Correctness A/B: runs both builds over the same corpora and compares every
 * observable output (sort order, filter hits, full match result objects).
 *
 *   node bench/compare.mjs baseline candidate
 *
 * Exits with code 1 and prints the first differences when anything diverges.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import {
  cityCorpus,
  duplicateCorpus,
  longCorpus,
  mixedCorpus,
  shuffle,
} from "./corpus.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const [, , nameA = "baseline", nameB = "candidate"] = process.argv;

async function load(name) {
  const file =
    name.includes("/") || name.includes("\\") || name.endsWith(".ts")
      ? path.resolve(process.cwd(), name)
      : name === "baseline"
        ? path.join(root, "baseline", "src", "index.ts")
        : name === "candidate"
          ? path.join(root, "src", "index.ts")
          : path.join(root, "bench", "variants", name, "index.ts");
  const outfile = path.join(here, "build", `compare-${file.replace(/[^a-z0-9]/gi, "_")}.mjs`);
  await (await import("esbuild")).build({
    entryPoints: [file],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node16",
    logLevel: "warning",
  });
  return import(pathToFileURL(outfile).href);
}

const A = await load(nameA);
const B = await load(nameB);

const cities = shuffle(cityCorpus(), 99);
const mixed = shuffle(mixedCorpus(), 99);
const dupes = shuffle(duplicateCorpus(), 99);
const long = shuffle(longCorpus(), 99);

/** Short ids so a diff stays readable. */
const idOf = (item) => (typeof item === "string" ? item : `${item.id}:${item.name}`);

const problems = [];
function checkEqual(label, left, right) {
  const a = JSON.stringify(left);
  const b = JSON.stringify(right);
  if (a !== b) {
    let at = 0;
    while (at < a.length && a[at] === b[at]) at += 1;
    problems.push({
      label,
      left: a.slice(Math.max(0, at - 80), at + 120),
      right: b.slice(Math.max(0, at - 80), at + 120),
    });
  }
}

const QUERIES = ["ah", "a", "ssjs", "zzqq", "new york", "SSJS", "émile", "chloe", "", " ", "-", "e"];

for (const query of QUERIES) {
  for (const caseSensitive of [false, true]) {
    for (const [corpusName, corpus, iterator] of [
      ["cities", cities, (item) => item.city],
      ["mixed", mixed, (item) => item.name],
      ["dupes", dupes, (item) => item.name],
      ["long", long, (item) => item.name],
    ]) {
      const left = corpus.slice().sort(A.sort(query, { iterator, caseSensitive }));
      const right = corpus.slice().sort(B.sort(query, { iterator, caseSensitive }));
      checkEqual(
        `sort ${corpusName} q=${JSON.stringify(query)} caseSensitive=${caseSensitive}`,
        left.map(idOf),
        right.map(idOf)
      );

      checkEqual(
        `filter ${corpusName} q=${JSON.stringify(query)} caseSensitive=${caseSensitive}`,
        corpus.filter(A.filter(query, { iterator, caseSensitive })).map(idOf),
        corpus.filter(B.filter(query, { iterator, caseSensitive })).map(idOf)
      );
    }
  }
}

// Full result objects, including ranges and score, on a deterministic sample.
function sampleSource(corpus, i) {
  const item = corpus[i % corpus.length];
  return item.city ?? item.name;
}

for (const query of QUERIES) {
  for (const caseSensitive of [false, true]) {
    for (const withScore of [false, true]) {
      for (let i = 0; i < 120; i += 1) {
        const source = sampleSource([cities, mixed, long][i % 3], i * 7);
        checkEqual(
          `match q=${JSON.stringify(query)} src=${JSON.stringify(source)} caseSensitive=${caseSensitive} withScore=${withScore}`,
          A.match(query, source, { caseSensitive, withScore }),
          B.match(query, source, { caseSensitive, withScore })
        );
        checkEqual(
          `test q=${JSON.stringify(query)} src=${JSON.stringify(source)} caseSensitive=${caseSensitive}`,
          A.test(query, source, { caseSensitive }),
          B.test(query, source, { caseSensitive })
        );
      }
    }
  }
}

// Explicit combining marks (decomposed input, e.g. what macOS file names can
// contain). Normalization shortens these strings, which the match loop has to
// survive without changing its historical result.
const RAGGED = ["cafe\u0301", "a\u0301", "e\u0301te\u0301", "\u0301", "a\u0301b\u0301c"];
for (const source of RAGGED) {
  for (const query of ["cafe", "café", "a", "abc", "", "\u0301"]) {
    checkEqual(
      `match ragged q=${JSON.stringify(query)} src=${JSON.stringify(source)}`,
      A.match(query, source, { withScore: true }),
      B.match(query, source, { withScore: true })
    );
    checkEqual(
      `test ragged q=${JSON.stringify(query)} src=${JSON.stringify(source)}`,
      A.test(query, source),
      B.test(query, source)
    );
  }
}

// Same query, same source, different objects: the cache must not mix them up.
const sameSource = [
  { id: 1, name: "AAA" },
  { id: 2, name: "aaa" },
  { id: 3, name: "AAA" },
  { id: 4, name: "bbb" },
];
checkEqual(
  "sort duplicate sources with different objects",
  sameSource.slice().sort(A.sort("aa", { iterator: (item) => item.name })).map(idOf),
  sameSource.slice().sort(B.sort("aa", { iterator: (item) => item.name })).map(idOf)
);

console.log(`compared ${nameA} vs ${nameB}`);
console.log(`  sort/filter: ${QUERIES.length} queries x 2 case modes x 4 corpora`);
console.log(`  match/test : ${QUERIES.length} queries x 2 case modes x 2 score modes x 120 sources`);

if (problems.length === 0) {
  console.log("  result: identical");
  process.exit(0);
}

console.log(`  result: ${problems.length} MISMATCH(ES)`);
for (const problem of problems.slice(0, 10)) {
  console.log(`\n  - ${problem.label}`);
  console.log(`    ${nameA}: ${problem.left}`);
  console.log(`    ${nameB}: ${problem.right}`);
}
process.exit(1);
