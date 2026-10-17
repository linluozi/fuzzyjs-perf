/**
 * Randomized differential test: generates strings from an alphabet that
 * includes ASCII, precomposed accents, explicit combining marks, CJK,
 * separators, surrogate pairs and the empty string, then compares every public
 * entry point of both builds.
 *
 *   node bench/fuzz.mjs baseline candidate [iterations]
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { createRandom } from "./corpus.mjs";
import { build } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const [, , nameA = "baseline", nameB = "candidate", iterationsArg] = process.argv;
const iterations = Number(iterationsArg || 20000);

async function load(name) {
  const file =
    name.includes("/") || name.includes("\\") || name.endsWith(".ts")
      ? path.resolve(process.cwd(), name)
      : name === "baseline"
        ? path.join(root, "baseline", "src", "index.ts")
        : name === "candidate"
          ? path.join(root, "src", "index.ts")
          : path.join(root, "bench", "variants", name, "index.ts");
  const outfile = path.join(here, "build", `fuzz-${file.replace(/[^a-z0-9]/gi, "_")}.mjs`);
  await build({
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

const ALPHABET = [
  "a", "b", "c", "e", "z", "A", "B", "E", "Z", "0", "1", "9", "_", "-", " ",
  ".", "/", "\\", ":", "é", "É", "ü", "Ü", "ñ", "Ñ", "中", "文", "😀", "ß",
  "\u0301", "\u0308", "café", "naïve", "Ána", "İ", "ı", "ﬁ",
];

const random = createRandom(424242);
const pick = (list) => list[Math.floor(random() * list.length)];

function randomString(maxLength) {
  const length = Math.floor(random() * (maxLength + 1));
  let out = "";
  for (let i = 0; i < length; i += 1) out += pick(ALPHABET);
  return out;
}

function randomQuery() {
  const shape = random();
  if (shape < 0.15) return "";
  if (shape < 0.3) return randomString(1);
  if (shape < 0.6) return randomString(3);
  return randomString(8);
}

let mismatches = 0;
let checks = 0;

function compare(label, left, right) {
  checks += 1;
  const a = JSON.stringify(left);
  const b = JSON.stringify(right);
  if (a === b) return;

  mismatches += 1;
  if (mismatches <= 10) {
    console.log(`\nMISMATCH ${label}`);
    console.log(`  ${nameA}: ${a}`);
    console.log(`  ${nameB}: ${b}`);
  }
}

for (let i = 0; i < iterations; i += 1) {
  const source = randomString(12);
  const query = randomQuery();
  const caseSensitive = random() < 0.4;

  compare(
    `match(${JSON.stringify(query)}, ${JSON.stringify(source)}, ${caseSensitive})`,
    A.match(query, source, { withScore: true, caseSensitive }),
    B.match(query, source, { withScore: true, caseSensitive })
  );

  compare(
    `match noScore`,
    A.match(query, source, { withScore: false, caseSensitive }),
    B.match(query, source, { withScore: false, caseSensitive })
  );

  compare(`test`, A.test(query, source, { caseSensitive }), B.test(query, source, { caseSensitive }));
}

// Sorting is compared on whole lists so that ordering and stability are both
// covered, including many duplicate and equal-score strings.
for (let i = 0; i < 400; i += 1) {
  const size = 1 + Math.floor(random() * 40);
  const items = Array.from({ length: size }, () => randomString(10));
  const query = randomQuery();
  const caseSensitive = random() < 0.4;

  compare(
    `sort(${JSON.stringify(query)}, n=${size})`,
    items.slice().sort(A.sort(query, { iterator: (item) => item, caseSensitive })),
    items.slice().sort(B.sort(query, { iterator: (item) => item, caseSensitive }))
  );

  compare(
    `filter(${JSON.stringify(query)}, n=${size})`,
    items.filter(A.filter(query, { iterator: (item) => item, caseSensitive })),
    items.filter(B.filter(query, { iterator: (item) => item, caseSensitive }))
  );
}

console.log(`\n${checks} comparisons over ${iterations} random string pairs`);
if (mismatches === 0) {
  console.log("result: identical");
  process.exit(0);
}
console.log(`result: ${mismatches} MISMATCH(ES)`);
process.exit(1);
