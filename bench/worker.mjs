/**
 * One process = one (implementation, scenario) pair. Nothing else runs here,
 * so heap state, JIT state and GC from another scenario can never leak in.
 *
 * Usage: node bench/worker.mjs <build.mjs> <scenario> [reps]
 * Prints one JSON line with every repetition in milliseconds.
 */
import { pathToFileURL } from "node:url";
import {
  cityCorpus,
  duplicateCorpus,
  longCorpus,
  mixedCorpus,
  shuffle,
} from "./corpus.mjs";

const [, , buildPath, scenarioName, repsArg] = process.argv;
const reps = Number(repsArg || 7);

const api = await import(pathToFileURL(buildPath).href);
const { filter, match, sort, test } = api;

/** Warm up every scenario on a small slice so JIT tiers settle before timing. */
const cities = shuffle(cityCorpus(), 42);
const mixed = shuffle(mixedCorpus(), 42);
const dupes = shuffle(duplicateCorpus(), 42);
const long = shuffle(longCorpus(), 42);

const scenarios = {
  "sort:cities:ah": () => {
    const input = cities.slice();
    input.sort(sort("ah", { iterator: (city) => city.city }));
    return input.map((city) => city.id).join(",");
  },
  "sort:cities:a": () => {
    const input = cities.slice();
    input.sort(sort("a", { iterator: (city) => city.city }));
    return input.map((city) => city.id).join(",");
  },
  "sort:mixed:ssjs": () => {
    let checksum = "";
    for (let round = 0; round < 3; round += 1) {
      const input = mixed.slice();
      input.sort(sort("ssjs", { iterator: (item) => item.name }));
      checksum = input.map((item) => item.id).join(",");
    }
    return checksum;
  },
  "sort:mixed:nomatch": () => {
    let checksum = "";
    // Cheap scenario: repeat so that a millisecond of noise cannot dominate.
    for (let round = 0; round < 5; round += 1) {
      const input = mixed.slice();
      input.sort(sort("zzqq", { iterator: (item) => item.name }));
      checksum = input.map((item) => item.id).join(",");
    }
    return checksum;
  },
  "sort:dupes": () => {
    let checksum = "";
    for (let round = 0; round < 50; round += 1) {
      const input = dupes.slice();
      input.sort(sort("zzqq", { iterator: (item) => item.name }));
      checksum = input.map((item) => item.id).join(",");
    }
    return checksum;
  },
  "sort:long": () => {
    const input = long.slice();
    input.sort(sort("lorem dolor", { iterator: (item) => item.name }));
    return input.map((item) => item.id).join(",");
  },
  "sort:cities:caseSensitive": () => {
    const input = cities.slice();
    input.sort(sort("Ah", { iterator: (city) => city.city, caseSensitive: true }));
    return input.map((city) => city.id).join(",");
  },
  "filter:cities:ah": () => {
    let hits = 0;
    for (let round = 0; round < 20; round += 1) {
      hits = cities.filter(filter("ah", { iterator: (city) => city.city })).length;
    }
    return hits;
  },
  "match:hot": () => {
    const sources = ["Set Syntax: JavaScript", "Apple Banana Caramel", "fuzzy search algorithm"];
    let total = 0;
    for (let i = 0; i < 150000; i += 1) {
      total += match("ssjs", sources[i % 3], { withScore: true }).score || 0;
    }
    return total;
  },
  "test:hot": () => {
    const sources = ["Set Syntax: JavaScript", "Apple Banana Caramel", "fuzzy search algorithm"];
    let total = 0;
    for (let i = 0; i < 400000; i += 1) {
      total += test("ssjs", sources[i % 3]) ? 1 : 0;
    }
    return total;
  },
  "test:earlyExit": () => {
    const source = `a${"x".repeat(2000)}`;
    let total = 0;
    for (let i = 0; i < 200000; i += 1) {
      total += test("a", source) ? 1 : 0;
    }
    return total;
  },
};

const scenario = scenarios[scenarioName];
if (!scenario) {
  console.error(`unknown scenario: ${scenarioName}`);
  process.exit(2);
}

// Warm-up: half of one repetition, then let it go.
scenario();
scenario();

const times = [];
let checksum;
for (let i = 0; i < reps; i += 1) {
  const start = process.hrtime.bigint();
  checksum = scenario();
  const end = process.hrtime.bigint();
  times.push(Number(end - start) / 1e6);
}

process.stdout.write(
  JSON.stringify({
    scenario: scenarioName,
    reps: times,
    checksum: hash(String(checksum)),
  }) + "\n"
);

/** FNV-1a, so an accidental empty/constant result cannot hide behind a length. */
function hash(input) {
  let value = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value.toString(16);
}
