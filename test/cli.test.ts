import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const wasm = (name: string) => `fixtures/wasm/${name}.wasm`;

function run(...args: string[]) {
  const r = spawnSync(process.execPath, ["src/cli.ts", ...args], { cwd: root, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

test("exits 0 for a compatible upgrade", () => {
  const r = run("diff", wasm("vault_v1"), wasm("vault_v2_compatible"));
  assert.equal(r.code, 0);
  assert.match(r.stdout, /result: compatible/);
});

test("exits 0 for risky changes by default", () => {
  assert.equal(run("diff", wasm("vault_v1"), wasm("vault_v2_risky")).code, 0);
});

test("exits 1 for risky changes with --fail-on risky", () => {
  assert.equal(run("diff", wasm("vault_v1"), wasm("vault_v2_risky"), "--fail-on", "risky").code, 1);
});

test("exits 1 for a breaking upgrade", () => {
  const r = run("diff", wasm("vault_v1"), wasm("vault_v2_breaking"));
  assert.equal(r.code, 1);
  assert.match(r.stdout, /BREAKING\s+fn last_action\s+function removed/);
  assert.match(r.stdout, /result: breaking/);
});

test("prints a JSON report", () => {
  const r = run("diff", wasm("vault_v1"), wasm("vault_v2_breaking"), "--format", "json");
  const report = JSON.parse(r.stdout);
  assert.equal(report.schema, 1);
  assert.equal(report.verdict, "breaking");
  assert.equal(report.summary.breaking, 5);
  assert.equal(report.old.source, "vault_v1.wasm");
  assert.match(report.old.wasmHash, /^[0-9a-f]{64}$/);
});

test("exits 2 on bad input", () => {
  assert.equal(run("diff", "missing.wasm", wasm("vault_v1")).code, 2);
  assert.equal(run("diff", wasm("vault_v1")).code, 2);
  assert.equal(run("diff", wasm("vault_v1"), wasm("vault_v1"), "--format", "xml").code, 2);
  assert.equal(run("nope").code, 2);
});

test("asks for a network when given a contract id", () => {
  const r = run("diff", "C" + "A".repeat(55), wasm("vault_v1"));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /--network or --rpc-url/);
});
