#!/bin/sh
# Write the full test run, with tool versions, to docs/evidence/test-log.txt.
set -u
cd "$(dirname "$0")/.."
out=docs/evidence/test-log.txt
{
  echo "SpecGuard test run"
  echo "commit:      $(git rev-parse --short HEAD)"
  echo "date (UTC):  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "node:        $(node --version)"
  echo "npm:         $(npm --version)"
  echo "stellar-sdk: $(node -p 'require("./node_modules/@stellar/stellar-sdk/package.json").version')"
  echo "typescript:  $(node -p 'require("./node_modules/typescript/package.json").version')"
  echo
  node --test --test-reporter=spec "test/**/*.test.ts" 2>&1
} > "$out"
tail -9 "$out"
