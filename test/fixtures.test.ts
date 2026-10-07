// End-to-end over the example contracts in fixtures/contracts, built to
// fixtures/wasm by scripts/build-fixtures.sh.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { interfaceFromWasm } from "../src/extract/spec.ts";
import { compare } from "../src/compare/diff.ts";

const load = (name: string) => interfaceFromWasm(new Uint8Array(readFileSync(new URL(`../fixtures/wasm/${name}.wasm`, import.meta.url))), name);
const v1 = load("vault_v1");
const rules = (name: string) => compare(v1, load(name)).changes.map((c) => `${c.severity}:${c.rule}:${c.path}`).sort();

test("reads the v1 interface", () => {
  assert.deepEqual(v1.functions.map((f) => f.name).sort(), ["__constructor", "deposit", "last_action", "position", "status", "upgrade", "withdraw"]);
  assert.deepEqual(v1.types.map((t) => `${t.kind} ${t.name}`).sort(), ["enum Status", "error VaultError", "struct Position", "union Action"]);
  assert.equal(v1.envMeta.protocol, 27);
  assert.match(v1.meta.rssdkver ?? "", /^27\./);
});

test("v1 against itself has no changes", () => {
  assert.deepEqual(rules("vault_v1"), []);
});

test("compatible upgrade", () => {
  assert.equal(compare(v1, load("vault_v2_compatible")).verdict, "compatible");
  assert.deepEqual(rules("vault_v2_compatible"), [
    "compatible:error-added:error VaultError::Locked",
    "compatible:fn-added:fn balance",
    "info:fn-doc:fn deposit",
  ]);
});

test("risky upgrade", () => {
  assert.equal(compare(v1, load("vault_v2_risky")).verdict, "risky");
  assert.deepEqual(rules("vault_v2_risky"), [
    "risky:enum-case-added:enum Status::Closed",
    "risky:error-removed:error VaultError::Paused",
    "risky:fn-input-renamed:fn withdraw(to)",
    "risky:union-case-added:union Action::Claim",
  ]);
});

test("breaking upgrade", () => {
  assert.equal(compare(v1, load("vault_v2_breaking")).verdict, "breaking");
  assert.deepEqual(rules("vault_v2_breaking"), [
    "breaking:error-code-changed:error VaultError::NotFound",
    "breaking:fn-input-type:fn deposit(amount)",
    "breaking:fn-output-type:fn position",
    "breaking:fn-removed:fn last_action",
    "breaking:struct-field-added:struct Position.fee",
  ]);
});

test("rejects Wasm without a contract spec", () => {
  const empty = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
  assert.throws(() => interfaceFromWasm(empty, "empty.wasm"), /no contractspecv0 section/);
});
