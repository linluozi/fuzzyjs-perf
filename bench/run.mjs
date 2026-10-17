/**
 * Reproducible A/B benchmark.
 *
 *   node bench/run.mjs baseline candidate
 *   node bench/run.mjs baseline candidate --reps=9 --runs=3
 *
 * Every (implementation, scenario) pair is measured in its own Node process,
 * because a previous scenario's heap (and the GC pressure it leaves behind)
 * changes the next scenario's numbers. For each scenario the reported value is
 * the best of all repetitions — the convention used by `timeit`, since noise
 * can only ever make a run slower.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const args = process.argv.slice(2);
const flags = new Map(
  args
    .filter((arg) => arg.startsWith("--"))
    .map((arg) => {
      const [key, value] = arg.replace(/^--/, "").split("=");
      return [key, value];
    })
);
const names = args.filter((arg) => !arg.startsWith("--"));

if (names.length < 2) {
  console.error("usage: node bench/run.mjs <implA> <implB> [--reps=7] [--runs=2]");
  process.exit(2);
}

const reps = Number(flags.get("reps") || 7);
const runs = Number(flags.get("runs") || 2);

const SCENARIOS = [
  "sort:cities:ah",
  "sort:cities:a",
  "sort:mixed:ssjs",
  "sort:mixed:nomatch",
  "sort:dupes",
  "sort:long",
  "sort:cities:caseSensitive",
  "filter:cities:ah",
  "match:hot",
  "test:hot",
  "test:earlyExit",
];

/**
 * Maps an implementation name to its entry point. A name that looks like a
 * path is used as-is, so a pristine checkout can be compared directly:
 *
 *   git worktree add ../fuzzyjs-baseline <commit>
 *   node bench/run.mjs ../fuzzyjs-baseline/src/index.ts src/index.ts
 */
function entryFor(name) {
  if (name.includes("/") || name.includes("\\") || name.endsWith(".ts")) {
    return path.resolve(process.cwd(), name);
  }
  if (name === "baseline") return path.join(root, "baseline", "src", "index.ts");
  if (name === "candidate") return path.join(root, "src", "index.ts");
  return path.join(root, "bench", "variants", name, "index.ts");
}

const outDir = path.join(here, "build");
mkdirSync(outDir, { recursive: true });

const builds = new Map();
for (const name of names) {
  const outfile = path.join(outDir, `${name}.mjs`);
  await build({
    entryPoints: [entryFor(name)],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node16",
    logLevel: "warning",
  });
  builds.set(name, outfile);
}

function measure(buildPath, scenario) {
  const output = execFileSync(
    process.execPath,
    [path.join(here, "worker.mjs"), buildPath, scenario, String(reps)],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }
  );
  return JSON.parse(output.trim().split("\n").pop());
}

const median = (values) => {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const results = {};
const checksums = {};

for (const scenario of SCENARIOS) {
  const samples = new Map(names.map((name) => [name, []]));
  results[scenario] = {};
  checksums[scenario] = {};

  // Interleave the implementations: A, B, A, B... so that a slow drift in CPU
  // frequency or background load hits both sides of the comparison instead of
  // only the one that happened to run second.
  for (let run = 0; run < runs; run += 1) {
    for (const name of names) {
      const { reps: times, checksum } = measure(builds.get(name), scenario);
      samples.get(name).push(...times);
      checksums[scenario][name] = checksum;
    }
  }

  for (const name of names) {
    const times = samples.get(name);
    results[scenario][name] = {
      best: Math.min(...times),
      median: median(times),
      samples: times.map((value) => Number(value.toFixed(3))),
    };
  }
}

const format = (value) => (value < 10 ? value.toFixed(2) : value.toFixed(1));
const [a, b] = names;

console.log("");
console.log(
  `Node ${process.version} · ${process.platform}/${process.arch} · reps=${reps} runs=${runs} · best-of-N (ms)`
);
console.log("");
console.log(
  ["scenario".padEnd(26), a.padStart(9), b.padStart(9), "speedup".padStart(9), "median Δ".padStart(10)].join("")
);
console.log("-".repeat(66));

for (const scenario of SCENARIOS) {
  const base = results[scenario][a].best;
  const next = results[scenario][b].best;
  const ratio = base / next;
  const medianRatio = results[scenario][a].median / results[scenario][b].median;
  console.log(
    [
      scenario.padEnd(26),
      format(base).padStart(9),
      format(next).padStart(9),
      `${ratio.toFixed(2)}x`.padStart(9),
      `${medianRatio.toFixed(2)}x`.padStart(10),
    ].join("")
  );
}

const mismatched = SCENARIOS.filter(
  (scenario) => checksums[scenario][a] !== checksums[scenario][b]
);
console.log("");
if (mismatched.length === 0) {
  console.log("checksums: identical output on every scenario");
} else {
  console.log(`checksums: MISMATCH on ${mismatched.join(", ")}`);
}

const payload = {
  node: process.version,
  platform: `${process.platform}/${process.arch}`,
  reps,
  runs,
  results,
  checksums,
};
writeFileSync(path.join(here, "results.json"), JSON.stringify(payload, null, 2));
console.log(`raw results written to bench/results.json`);
