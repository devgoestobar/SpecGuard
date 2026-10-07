#!/bin/sh
# Rebuild the example contracts and refresh the committed Wasm in fixtures/wasm.
# Needs the stellar CLI and a Rust toolchain with the wasm32v1-none target.
set -eu
cd "$(dirname "$0")/../fixtures/contracts"
stellar contract build
for f in target/wasm32v1-none/release/*.wasm; do
  cp "$f" ../wasm/
done
ls -l ../wasm/*.wasm
