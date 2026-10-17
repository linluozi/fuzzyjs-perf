import test from "ava";
import { createScoreCache } from "../scoreCache";

test("computes each distinct source exactly once", (t) => {
  const calls: string[] = [];
  const score = createScoreCache((source) => {
    calls.push(source);
    return source.length;
  });

  score("ab");
  score("ab");
  score("abc");
  score("ab");

  t.deepEqual(calls, ["ab", "abc"]);
  t.is(score("ab"), 2);
  t.is(score("abc"), 3);
});

test("caches a score of 0 instead of recomputing it", (t) => {
  // Regression: `sort` used `cache.get(source) ? cached : compute(...)`, so a
  // legitimate score of 0 (no match at all, or a match whose score nets to 0)
  // was treated as a cache miss and recomputed on every comparison.
  let calls = 0;
  const score = createScoreCache(() => {
    calls += 1;
    return 0;
  });

  t.is(score("foobar"), 0);
  t.is(score("foobar"), 0);
  t.is(score("foobar"), 0);

  t.is(calls, 1, "a cached 0 must not trigger a new computation");
});

test("caches negative scores", (t) => {
  let calls = 0;
  const score = createScoreCache((source) => {
    calls += 1;
    return -source.length;
  });

  t.is(score("abc"), -3);
  t.is(score("abc"), -3);
  t.is(calls, 1);
});

test("does not confuse two different sources with the same length", (t) => {
  const score = createScoreCache((source) => (source === "abc" ? 10 : 0));

  t.is(score("abc"), 10);
  t.is(score("xyz"), 0);
  t.is(score("abc"), 10);
});

test("passes the source through to the computer untouched", (t) => {
  const seen: string[] = [];
  const score = createScoreCache((source) => {
    seen.push(source);
    return 1;
  });

  score("  MiXeD Café  ");
  t.deepEqual(seen, ["  MiXeD Café  "]);
});
