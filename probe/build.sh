#!/usr/bin/env bash
# Builds the two instrumented bundles used by probe/count.js and the bundle
# used by probe/isLeading-equivalence.js.
set -euo pipefail
cd "$(dirname "$0")/.."

node probe/make-instrumented.mjs baseline/src probe/.build/instrumented-baseline
node probe/make-instrumented.mjs src probe/.build/instrumented-candidate

npx esbuild probe/.build/instrumented-baseline/array.ts \
  --bundle --outfile=probe/.build/out-instr/array.js \
  --format=cjs --platform=node --target=node16 --log-level=warning

npx esbuild probe/.build/instrumented-candidate/array.ts \
  --bundle --outfile=probe/.build/out-instr-candidate/array.js \
  --format=cjs --platform=node --target=node16 --log-level=warning

npx esbuild src/utils/isLeading.ts \
  --bundle --outfile=probe/.build/out/isLeading.js \
  --format=cjs --platform=node --target=node16 --log-level=warning

echo "built: probe/.build/{out-instr,out-instr-candidate,out}"
