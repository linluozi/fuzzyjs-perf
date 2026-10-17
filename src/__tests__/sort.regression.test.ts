import test from "ava";
import { sort, SortOptions } from "../array";
import { match } from "../match";

interface Item {
  id: number;
  name: string;
}

/**
 * Independent oracle: stable-sort the items by the score `match` gives them.
 * It never goes through the cache that `sort` uses, so any wrong cached value
 * shows up as a different order.
 */
function referenceSort<TItem>(
  query: string,
  items: TItem[],
  options: SortOptions<TItem>
): TItem[] {
  return items
    .map((item, index) => ({
      item,
      index,
      score: match(query, options.iterator(item), {
        withScore: true,
        caseSensitive: options.caseSensitive,
      }).score as number,
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.item);
}

function ids(items: Item[]): number[] {
  return items.map((item) => item.id);
}

test("orders exactly like an uncached score computation", (t) => {
  const items: Item[] = [
    { id: 0, name: "Alpha Beta Gamma" },
    { id: 1, name: "alpha beta gamma" },
    { id: 2, name: "ALPHA BETA GAMMA" },
    { id: 3, name: "zzz nothing here" },
    { id: 4, name: "Alpha Beta Gamma" },
    { id: 5, name: "café bravo charlie" },
    { id: 6, name: "" },
    { id: 7, name: "a" },
  ];

  for (const query of ["abg", "a", "zz", "ALPHA", ""]) {
    for (const caseSensitive of [false, true]) {
      const options = { iterator: (item: Item) => item.name, caseSensitive };
      t.deepEqual(
        ids(items.slice().sort(sort(query, options))),
        ids(referenceSort(query, items, options)),
        `query=${JSON.stringify(query)} caseSensitive=${caseSensitive}`
      );
    }
  }
});

test("keeps items whose score is exactly 0 in a stable order", (t) => {
  // "A" is leading (+10) and the ten following characters score -1 each, so
  // the final score is exactly 0 even though the query does match.
  const zeroScore = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    name: `A${String(i).padStart(10, "0")}`,
  }));
  const noMatch = Array.from({ length: 12 }, (_, i) => ({
    id: 100 + i,
    name: `zzz-${i}`,
  }));

  t.is(match("a", zeroScore[0].name).score, 0, "precondition: a real 0 score");
  t.true(match("a", zeroScore[0].name).match, "precondition: it does match");
  t.is(match("a", noMatch[0].name).score, 0, "precondition: no match is 0 too");
  t.false(match("a", noMatch[0].name).match);

  const items = [...zeroScore, ...noMatch];
  const options = { iterator: (item: Item) => item.name };

  // Every item scores 0, so the sort must be a no-op; if the cache treated 0 as
  // "missing" it would still be a no-op, but a wrong cache value would not.
  t.deepEqual(ids(items.slice().sort(sort("a", options))), ids(items));
});

test("keeps duplicate sources and case variants apart", (t) => {
  const items: Item[] = [
    { id: 1, name: "Set Syntax: JavaScript" },
    { id: 2, name: "set syntax: javascript" },
    { id: 3, name: "SET SYNTAX: JAVASCRIPT" },
    { id: 4, name: "Set Syntax: JavaScript" },
    { id: 5, name: "Set Syntax: Java" },
    { id: 6, name: "Set Syntax: CSS" },
  ];

  for (const query of ["ssjs", "ssj", "javascript", "SSJS"]) {
    for (const caseSensitive of [false, true]) {
      const options = { iterator: (item: Item) => item.name, caseSensitive };
      t.deepEqual(
        ids(items.slice().sort(sort(query, options))),
        ids(referenceSort(query, items, options))
      );
    }
  }
});

test("handles a large corpus of mostly non-matching items", (t) => {
  const items: Item[] = Array.from({ length: 300 }, (_, i) => ({
    id: i,
    name: i % 3 === 0 ? `Zulu ${i}` : `Alpha Bravo ${i % 17}`,
  }));

  const options = { iterator: (item: Item) => item.name };
  t.deepEqual(
    ids(items.slice().sort(sort("zzz", options))),
    ids(referenceSort("zzz", items, options))
  );
  t.deepEqual(
    ids(items.slice().sort(sort("ab", options))),
    ids(referenceSort("ab", items, options))
  );
});

test("does not let the cache leak between two sort calls", (t) => {
  const items: Item[] = [
    { id: 1, name: "Alpha" },
    { id: 2, name: "Alpine" },
    { id: 3, name: "Beta" },
  ];

  const first = ids(
    items.slice().sort(sort("al", { iterator: (item) => item.name }))
  );
  const second = ids(
    items.slice().sort(sort("be", { iterator: (item) => item.name }))
  );

  t.deepEqual(first, [1, 2, 3]);
  t.deepEqual(second, [3, 1, 2]);
});

test("sorts an empty array and a single item", (t) => {
  const options = { iterator: (item: Item) => item.name };
  const empty: Item[] = [];
  t.deepEqual(empty.sort(sort("a", options)), []);
  t.deepEqual(ids([{ id: 1, name: "only" }].sort(sort("a", options))), [1]);
});
