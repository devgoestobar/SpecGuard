import { test } from "node:test";
import assert from "node:assert/strict";
import { readCustomSection, SPEC_SECTION } from "../src/extract/wasm.ts";

// Smallest valid module: magic + version, then one custom section (id 0).
function moduleWithCustomSection(name: string, payload: number[]): Uint8Array<ArrayBuffer> {
  const nameBytes = [...new TextEncoder().encode(name)];
  const body = [nameBytes.length, ...nameBytes, ...payload];
  return new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x00, body.length, ...body]);
}

test("reads a named custom section", () => {
  const wasm = moduleWithCustomSection(SPEC_SECTION, [1, 2, 3]);
  assert.deepEqual(readCustomSection(wasm, SPEC_SECTION), new Uint8Array([1, 2, 3]));
});

test("returns undefined when the section is missing", () => {
  const wasm = moduleWithCustomSection("other", [1]);
  assert.equal(readCustomSection(wasm, SPEC_SECTION), undefined);
});

test("rejects bytes that are not a Wasm module", () => {
  assert.throws(() => readCustomSection(new Uint8Array([1, 2, 3]), SPEC_SECTION));
});
