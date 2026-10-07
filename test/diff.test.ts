import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { compare } from "../src/compare/diff.ts";
import type { CustomType } from "../src/model.ts";
import { fn, iface } from "./helpers.ts";

function rules(a: Parameters<typeof iface>[0], b: Parameters<typeof iface>[0]): string[] {
  return compare(iface(a), iface(b)).changes.map((c) => `${c.severity}:${c.rule}`);
}

describe("functions", () => {
  test("removed function is breaking", () => {
    assert.deepEqual(rules({ functions: [fn("a"), fn("b")] }, { functions: [fn("a")] }), ["breaking:fn-removed"]);
  });

  test("added function is compatible", () => {
    assert.deepEqual(rules({ functions: [fn("a")] }, { functions: [fn("a"), fn("b")] }), ["compatible:fn-added"]);
  });

  test("argument count change is breaking", () => {
    assert.deepEqual(rules({ functions: [fn("a", [["x", "u32"]])] }, { functions: [fn("a", [["x", "u32"], ["y", "u32"]])] }), ["breaking:fn-input-count"]);
  });

  test("argument type change is breaking", () => {
    assert.deepEqual(rules({ functions: [fn("a", [["x", "u32"]])] }, { functions: [fn("a", [["x", "u64"]])] }), ["breaking:fn-input-type"]);
  });

  test("T to Option<T> argument is risky", () => {
    assert.deepEqual(rules({ functions: [fn("a", [["x", "u32"]])] }, { functions: [fn("a", [["x", "Option<u32>"]])] }), ["risky:fn-input-optional"]);
  });

  test("Option<T> to T argument is breaking", () => {
    assert.deepEqual(rules({ functions: [fn("a", [["x", "Option<u32>"]])] }, { functions: [fn("a", [["x", "u32"]])] }), ["breaking:fn-input-type"]);
  });

  test("renamed argument is risky", () => {
    assert.deepEqual(rules({ functions: [fn("a", [["to", "Address"]])] }, { functions: [fn("a", [["recipient", "Address"]])] }), ["risky:fn-input-renamed"]);
  });

  test("swapped arguments of the same type are breaking", () => {
    const before = fn("transfer", [["from", "Address"], ["to", "Address"]]);
    const after = fn("transfer", [["to", "Address"], ["from", "Address"]]);
    assert.deepEqual(rules({ functions: [before] }, { functions: [after] }), ["breaking:fn-input-reordered"]);
  });

  test("return type change is breaking", () => {
    assert.deepEqual(rules({ functions: [fn("a", [], "u32")] }, { functions: [fn("a", [], "u64")] }), ["breaking:fn-output-type"]);
  });

  test("doc change is info", () => {
    assert.deepEqual(rules({ functions: [fn("a")] }, { functions: [fn("a", [], "()", { doc: "new" })] }), ["info:fn-doc"]);
  });

  test("constructor changes are info", () => {
    const r = rules({ functions: [fn("__constructor", [["admin", "Address"]])] }, { functions: [fn("__constructor", [["admin", "Address"], ["fee", "u32"]])] });
    assert.deepEqual(r, ["info:fn-input-count"]);
  });

  test("identical interfaces have no changes", () => {
    const a = { functions: [fn("a", [["x", "u32"]], "bool")] };
    const report = compare(iface(a), iface(a));
    assert.equal(report.changes.length, 0);
    assert.equal(report.verdict, "compatible");
  });
});

const struct = (name: string, fields: [string, string][], doc = ""): CustomType => ({ kind: "struct", name, doc, fields: fields.map(([n, t]) => ({ name: n, type: t })), refs: [] });
const union = (name: string, cases: [string, string[]][]): CustomType => ({ kind: "union", name, doc: "", cases: cases.map(([n, t]) => ({ name: n, types: t })), refs: [] });
const enm = (name: string, cases: [string, number][], kind: "enum" | "error" = "enum"): CustomType => ({ kind, name, doc: "", cases: cases.map(([n, v]) => ({ name: n, value: v })), refs: [] });
const user = (type: string) => [fn("get", [], type)];

describe("structs", () => {
  test("added, removed and retyped fields are breaking", () => {
    const r = rules(
      { functions: user("P"), types: [struct("P", [["a", "u32"], ["b", "u32"]])] },
      { functions: user("P"), types: [struct("P", [["a", "u64"], ["c", "u32"]])] },
    );
    assert.deepEqual(r.sort(), ["breaking:struct-field-added", "breaking:struct-field-removed", "breaking:struct-field-type"]);
  });

  test("field order in a named struct does not matter", () => {
    const r = rules({ types: [struct("P", [["a", "u32"], ["b", "i128"]])] }, { types: [struct("P", [["b", "i128"], ["a", "u32"]])] });
    assert.deepEqual(r, []);
  });

  test("field order in a tuple struct matters", () => {
    const r = rules({ types: [struct("T", [["0", "u32"], ["1", "i128"]])] }, { types: [struct("T", [["0", "i128"], ["1", "u32"]])] });
    assert.deepEqual(r, ["breaking:struct-field-type", "breaking:struct-field-type"]);
  });

  test("changes carry the functions that use the type", () => {
    const report = compare(
      iface({ functions: [fn("get", [], "Outer")], types: [{ ...struct("Outer", [["inner", "Inner"]]), refs: ["Inner"] }, struct("Inner", [["a", "u32"]])] }),
      iface({ functions: [fn("get", [], "Outer")], types: [{ ...struct("Outer", [["inner", "Inner"]]), refs: ["Inner"] }, struct("Inner", [["a", "u64"]])] }),
    );
    assert.deepEqual(report.changes[0]?.usedBy, ["get"]);
  });
});

describe("types", () => {
  test("removing a used type is breaking", () => {
    assert.deepEqual(rules({ functions: user("P"), types: [struct("P", [["a", "u32"]])] }, { functions: user("P") }), ["breaking:type-removed"]);
  });

  test("removing an unused type is info", () => {
    assert.deepEqual(rules({ types: [struct("P", [["a", "u32"]])] }, {}), ["info:type-removed-unused"]);
  });

  test("adding a type is compatible", () => {
    assert.deepEqual(rules({}, { types: [struct("P", [["a", "u32"]])] }), ["compatible:type-added"]);
  });

  test("changing kind is breaking", () => {
    assert.deepEqual(rules({ types: [struct("P", [["a", "u32"]])] }, { types: [union("P", [["A", []]])] }), ["breaking:type-kind"]);
  });

  test("type doc change is info", () => {
    assert.deepEqual(rules({ types: [struct("P", [["a", "u32"]])] }, { types: [struct("P", [["a", "u32"]], "docs")] }), ["info:type-doc"]);
  });
});

describe("unions", () => {
  test("added case is risky, removed or changed case is breaking", () => {
    const r = rules(
      { types: [union("A", [["X", ["i128"]], ["Y", []]])] },
      { types: [union("A", [["X", ["u64"]], ["Z", []]])] },
    );
    assert.deepEqual(r.sort(), ["breaking:union-case-removed", "breaking:union-case-type", "risky:union-case-added"]);
  });
});

describe("enums", () => {
  test("added value is risky", () => {
    assert.deepEqual(rules({ types: [enm("S", [["A", 0]])] }, { types: [enm("S", [["A", 0], ["B", 1]])] }), ["risky:enum-case-added"]);
  });

  test("removed value is breaking", () => {
    assert.deepEqual(rules({ types: [enm("S", [["A", 0], ["B", 1]])] }, { types: [enm("S", [["A", 0]])] }), ["breaking:enum-case-removed"]);
  });

  test("renumbered value is breaking", () => {
    assert.deepEqual(rules({ types: [enm("S", [["A", 0]])] }, { types: [enm("S", [["A", 5]])] }), ["breaking:enum-value-changed"]);
  });

  test("renamed value is risky", () => {
    assert.deepEqual(rules({ types: [enm("S", [["A", 0]])] }, { types: [enm("S", [["Alpha", 0]])] }), ["risky:enum-case-renamed"]);
  });
});

describe("errors", () => {
  const err = (cases: [string, number][]) => [enm("E", cases, "error")];

  test("added code is compatible", () => {
    assert.deepEqual(rules({ types: err([["A", 1]]) }, { types: err([["A", 1], ["B", 2]]) }), ["compatible:error-added"]);
  });

  test("removed code is risky", () => {
    assert.deepEqual(rules({ types: err([["A", 1], ["B", 2]]) }, { types: err([["A", 1]]) }), ["risky:error-removed"]);
  });

  test("changed code is breaking", () => {
    assert.deepEqual(rules({ types: err([["A", 1]]) }, { types: err([["A", 10]]) }), ["breaking:error-code-changed"]);
  });

  test("renamed code is info", () => {
    assert.deepEqual(rules({ types: err([["A", 1]]) }, { types: err([["Alpha", 1]]) }), ["info:error-renamed"]);
  });
});

describe("metadata", () => {
  test("newer protocol is risky", () => {
    assert.deepEqual(rules({ protocol: 25 }, { protocol: 27 }), ["risky:env-protocol"]);
  });

  test("build metadata change is info", () => {
    assert.deepEqual(rules({ meta: { rssdkver: "26.0.0" } }, { meta: { rssdkver: "27.0.6" } }), ["info:meta-changed"]);
  });
});

describe("verdict", () => {
  test("is the highest severity found", () => {
    assert.equal(compare(iface({ functions: [fn("a")] }), iface({ functions: [fn("a"), fn("b")] })).verdict, "compatible");
    assert.equal(compare(iface({ types: [enm("S", [["A", 0]])] }), iface({ types: [enm("S", [["A", 0], ["B", 1]])] })).verdict, "risky");
    assert.equal(compare(iface({ functions: [fn("a")] }), iface({})).verdict, "breaking");
  });
});
