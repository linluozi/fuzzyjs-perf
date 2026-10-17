/**
 * Deterministic corpora shared by the benchmark and the A/B comparison.
 * Everything is seeded so two builds always see byte-identical input.
 */

/** Small, fast, deterministic PRNG (LCG). Same sequence on every platform. */
export function createRandom(seed = 20261017) {
  let state = seed >>> 0;
  return function random() {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return state / 4294967296;
  };
}

export function shuffle(items, seed = 20261017) {
  const out = items.slice();
  const random = createRandom(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const FIRST_NAMES = [
  "Ana", "ana", "ANA", "Ána", "Bob", "bob", "Chloé", "chloe", "Dave", "dave",
  "Émile", "emile", "Fátima", "fatima", "Gus", "gus", "Håkan", "hakan", "Iris",
  "iris", "João", "joao", "Kai", "kai", "Léa", "lea", "Mona", "mona", "Nils",
];
const LAST_NAMES = [
  "Smith", "smith", "SMITH", "Jones", "jones", "Müller", "muller", "O'Brien",
  "obrien", "García", "garcia", "Nakamura", "nakamura", "Silva", "silva",
];

/**
 * Mixed corpus: case variants, accents, exact duplicates, and a large tail of
 * items that cannot match the query at all (their score is exactly 0).
 */
export function mixedCorpus(size = 2000, seed = 7) {
  const random = createRandom(seed);
  const items = [];
  for (let i = 0; i < size; i += 1) {
    const roll = random();
    const first = FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(random() * LAST_NAMES.length)];
    const tail = String(Math.floor(random() * 10000)).padStart(4, "0");
    if (roll < 0.35) {
      // cannot contain "ssjs" nor "sh" in this shape
      items.push({ id: i, name: `User ${tail} ${last}` });
    } else if (roll < 0.7) {
      items.push({ id: i, name: `${first} ${last} ${tail}` });
    } else if (roll < 0.85) {
      // duplicates on purpose
      items.push({ id: i, name: `${first} ${last}` });
    } else {
      items.push({ id: i, name: `SSJS ${first} ${last} ${tail}` });
    }
  }
  return items;
}

/** Only 10 distinct source strings, repeated: pure cache-pressure corpus. */
export function duplicateCorpus(size = 1000) {
  return Array.from({ length: size }, (_, i) => ({
    id: i,
    name: `Zulu-${String(i % 10).padStart(2, "0")}`,
  }));
}

/** Long strings: string preprocessing dominates. */
export function longCorpus(size = 500, seed = 11) {
  const random = createRandom(seed);
  const words = [
    "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing",
    "elit", "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore",
  ];
  return Array.from({ length: size }, (_, i) => {
    const parts = [];
    for (let w = 0; w < 30; w += 1) {
      parts.push(words[Math.floor(random() * words.length)]);
    }
    return { id: i, name: `${parts.join(" ")} ${i}` };
  });
}

export function cityCorpus() {
  return require("../benchmark/cities.json").map((city, id) => ({ id, ...city }));
}
