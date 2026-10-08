#!/bin/sh
# Regenerate the sample reports in examples/reports from the fixture contracts.
set -u
cd "$(dirname "$0")/.."
out=examples/reports
mkdir -p "$out"
for case in compatible risky breaking; do
  node src/cli.ts diff fixtures/wasm/vault_v1.wasm "fixtures/wasm/vault_v2_$case.wasm" \
    --no-color --out "$out/$case.json" > "$out/$case.txt"
  node src/cli.ts render "$out/$case.json" --format markdown > "$out/$case.md"
done
ls -1 "$out"
