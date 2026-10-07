// Applies the rules in docs/RULES.md to two normalized interfaces.

import type { Change, ContractInterface, CustomType, EnumType, Fn, Report, Severity, StructType, UnionType } from "../model.ts";
import { SEVERITIES } from "../model.ts";

const CONSTRUCTOR = "__constructor";

export function compare(oldI: ContractInterface, newI: ContractInterface): Report {
  const changes: Change[] = [];
  const usage = mergeUsage(usedBy(oldI), usedBy(newI));

  compareFunctions(oldI.functions, newI.functions, changes);
  compareTypes(oldI.types, newI.types, usedBy(oldI), usage, changes);
  compareMeta(oldI, newI, changes);

  changes.sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));

  const summary = { breaking: 0, risky: 0, compatible: 0, info: 0 } satisfies Record<Severity, number>;
  for (const c of changes) summary[c.severity]++;
  const verdict = summary.breaking ? "breaking" : summary.risky ? "risky" : "compatible";

  return {
    schema: 1,
    old: { source: oldI.source, wasmHash: oldI.wasmHash },
    new: { source: newI.source, wasmHash: newI.wasmHash },
    verdict,
    summary,
    changes,
  };
}

// ---------------------------------------------------------------- functions

function compareFunctions(oldFns: Fn[], newFns: Fn[], out: Change[]): void {
  const before = byName(oldFns);
  const after = byName(newFns);

  for (const [name, o] of before) {
    const n = after.get(name);
    if (!n) {
      push(out, name, { severity: "breaking", rule: "fn-removed", path: `fn ${name}`, message: "function removed", before: signature(o) });
      continue;
    }
    compareFunction(o, n, out);
  }
  for (const [name, n] of after) {
    if (!before.has(name)) {
      push(out, name, { severity: "compatible", rule: "fn-added", path: `fn ${name}`, message: "function added", after: signature(n) });
    }
  }
}

function compareFunction(o: Fn, n: Fn, out: Change[]): void {
  const fn = `fn ${o.name}`;

  if (o.inputs.length !== n.inputs.length) {
    push(out, o.name, {
      severity: "breaking",
      rule: "fn-input-count",
      path: fn,
      message: `takes ${n.inputs.length} argument(s), was ${o.inputs.length}`,
      before: signature(o),
      after: signature(n),
    });
  } else {
    const oldNames = o.inputs.map((p) => p.name);
    let reordered = false;
    o.inputs.forEach((op, i) => {
      const np = n.inputs[i]!;
      if (op.type !== np.type) {
        const optional = np.type === `Option<${op.type}>`;
        push(out, o.name, {
          severity: optional ? "risky" : "breaking",
          rule: optional ? "fn-input-optional" : "fn-input-type",
          path: `${fn}(${op.name})`,
          message: optional ? "argument became optional" : "argument type changed",
          before: op.type,
          after: np.type,
        });
      } else if (op.name !== np.name) {
        const movedFrom = oldNames.indexOf(np.name);
        if (movedFrom !== -1 && movedFrom !== i) {
          reordered = true;
        } else {
          push(out, o.name, {
            severity: "risky",
            rule: "fn-input-renamed",
            path: `${fn}(${op.name})`,
            message: "argument renamed",
            before: op.name,
            after: np.name,
          });
        }
      }
    });
    if (reordered) {
      push(out, o.name, {
        severity: "breaking",
        rule: "fn-input-reordered",
        path: fn,
        message: "arguments of the same type changed position",
        before: signature(o),
        after: signature(n),
      });
    }
  }

  if (o.output !== n.output) {
    push(out, o.name, { severity: "breaking", rule: "fn-output-type", path: fn, message: "return type changed", before: o.output, after: n.output });
  }
  if (o.doc !== n.doc) {
    push(out, o.name, { severity: "info", rule: "fn-doc", path: fn, message: "doc comment changed" });
  }
}

// Constructor changes never reach existing callers: it only runs at deploy.
function push(out: Change[], fnName: string, c: Change): void {
  if (fnName === CONSTRUCTOR && c.severity !== "info") {
    out.push({ ...c, severity: "info", message: `${c.message} (constructor only runs at deploy)` });
  } else {
    out.push(c);
  }
}

function signature(f: Fn): string {
  const args = f.inputs.map((p) => `${p.name}: ${p.type}`).join(", ");
  return f.output === "()" ? `${f.name}(${args})` : `${f.name}(${args}) -> ${f.output}`;
}

// ------------------------------------------------------------------- types

function compareTypes(
  oldTypes: CustomType[],
  newTypes: CustomType[],
  oldUsage: Map<string, string[]>,
  usage: Map<string, string[]>,
  out: Change[],
): void {
  const before = byName(oldTypes);
  const after = byName(newTypes);

  for (const [name, o] of before) {
    const n = after.get(name);
    const users = usage.get(name);
    const tag = (c: Change): Change => (users?.length ? { ...c, usedBy: users } : c);

    if (!n) {
      const used = (oldUsage.get(name) ?? []).length > 0;
      out.push(tag({
        severity: used ? "breaking" : "info",
        rule: used ? "type-removed" : "type-removed-unused",
        path: `${o.kind} ${name}`,
        message: used ? "type removed" : "unused type removed",
      }));
      continue;
    }
    if (o.kind !== n.kind) {
      out.push(tag({ severity: "breaking", rule: "type-kind", path: name, message: "type changed kind", before: o.kind, after: n.kind }));
      continue;
    }
    const found: Change[] = [];
    if (o.kind === "struct") compareStruct(o, n as StructType, found);
    else if (o.kind === "union") compareUnion(o, n as UnionType, found);
    else if (o.kind === "enum") compareEnum(o, n as EnumType, found);
    else compareErrors(o, n as EnumType, found);
    if (o.doc !== n.doc) found.push({ severity: "info", rule: "type-doc", path: `${o.kind} ${name}`, message: "doc comment changed" });
    out.push(...found.map(tag));
  }
  for (const [name, n] of after) {
    if (!before.has(name)) {
      out.push({ severity: "compatible", rule: "type-added", path: `${n.kind} ${name}`, message: "type added" });
    }
  }
}

function compareStruct(o: StructType, n: StructType, out: Change[]): void {
  // Tuple structs name their fields "0", "1", ... and encode as a vector, so
  // position matters. Named structs encode as a map, so only names matter.
  const tuple = isTuple(o) || isTuple(n);
  const key = (f: { name: string }, i: number) => (tuple ? String(i) : f.name);
  const before = new Map(o.fields.map((f, i) => [key(f, i), f]));
  const after = new Map(n.fields.map((f, i) => [key(f, i), f]));
  const path = (f: string) => `struct ${o.name}.${f}`;

  for (const [k, f] of before) {
    const g = after.get(k);
    if (!g) out.push({ severity: "breaking", rule: "struct-field-removed", path: path(k), message: "field removed", before: f.type });
    else if (f.type !== g.type) out.push({ severity: "breaking", rule: "struct-field-type", path: path(k), message: "field type changed", before: f.type, after: g.type });
  }
  for (const [k, g] of after) {
    if (!before.has(k)) out.push({ severity: "breaking", rule: "struct-field-added", path: path(k), message: "field added", after: g.type });
  }
}

function isTuple(s: StructType): boolean {
  return s.fields.length > 0 && s.fields.every((f, i) => f.name === String(i));
}

function compareUnion(o: UnionType, n: UnionType, out: Change[]): void {
  const before = byName(o.cases);
  const after = byName(n.cases);
  const path = (c: string) => `union ${o.name}::${c}`;
  const show = (types: string[]) => (types.length ? `(${types.join(", ")})` : "(no data)");

  for (const [name, c] of before) {
    const d = after.get(name);
    if (!d) out.push({ severity: "breaking", rule: "union-case-removed", path: path(name), message: "case removed" });
    else if (show(c.types) !== show(d.types)) {
      out.push({ severity: "breaking", rule: "union-case-type", path: path(name), message: "case data changed", before: show(c.types), after: show(d.types) });
    }
  }
  for (const [name] of after) {
    if (!before.has(name)) out.push({ severity: "risky", rule: "union-case-added", path: path(name), message: "case added; old clients cannot decode it" });
  }
}

function compareEnum(o: EnumType, n: EnumType, out: Change[]): void {
  const path = (c: string) => `enum ${o.name}::${c}`;
  const newByName = byName(n.cases);
  const newByValue = new Map(n.cases.map((c) => [c.value, c]));
  const oldNames = new Set(o.cases.map((c) => c.name));
  const oldValues = new Set(o.cases.map((c) => c.value));

  for (const c of o.cases) {
    const sameName = newByName.get(c.name);
    const sameValue = newByValue.get(c.value);
    if (sameName && sameName.value !== c.value) {
      out.push({ severity: "breaking", rule: "enum-value-changed", path: path(c.name), message: "value changed", before: String(c.value), after: String(sameName.value) });
    } else if (!sameName && sameValue && !oldNames.has(sameValue.name)) {
      out.push({ severity: "risky", rule: "enum-case-renamed", path: path(c.name), message: `renamed (value ${c.value})`, before: c.name, after: sameValue.name });
    } else if (!sameName) {
      out.push({ severity: "breaking", rule: "enum-case-removed", path: path(c.name), message: "value removed", before: String(c.value) });
    }
  }
  for (const c of n.cases) {
    if (!oldNames.has(c.name) && !oldValues.has(c.value)) {
      out.push({ severity: "risky", rule: "enum-case-added", path: path(c.name), message: "value added; old clients cannot decode it", after: String(c.value) });
    }
  }
}

function compareErrors(o: EnumType, n: EnumType, out: Change[]): void {
  const path = (c: string) => `error ${o.name}::${c}`;
  const newByName = byName(n.cases);
  const newByValue = new Map(n.cases.map((c) => [c.value, c]));
  const oldNames = new Set(o.cases.map((c) => c.name));
  const oldValues = new Set(o.cases.map((c) => c.value));

  for (const c of o.cases) {
    const sameName = newByName.get(c.name);
    const sameValue = newByValue.get(c.value);
    if (sameName && sameName.value !== c.value) {
      out.push({ severity: "breaking", rule: "error-code-changed", path: path(c.name), message: "error code changed", before: String(c.value), after: String(sameName.value) });
    } else if (!sameName && sameValue && !oldNames.has(sameValue.name)) {
      out.push({ severity: "info", rule: "error-renamed", path: path(c.name), message: `renamed (code ${c.value})`, before: c.name, after: sameValue.name });
    } else if (!sameName) {
      out.push({ severity: "risky", rule: "error-removed", path: path(c.name), message: "error code removed", before: String(c.value) });
    }
  }
  for (const c of n.cases) {
    if (!oldNames.has(c.name) && !oldValues.has(c.value)) {
      out.push({ severity: "compatible", rule: "error-added", path: path(c.name), message: "error code added", after: String(c.value) });
    }
  }
}

// ---------------------------------------------------------------- metadata

function compareMeta(o: ContractInterface, n: ContractInterface, out: Change[]): void {
  const op = o.envMeta.protocol;
  const np = n.envMeta.protocol;
  if (op !== undefined && np !== undefined && np > op) {
    out.push({ severity: "risky", rule: "env-protocol", path: "env protocol", message: `requires protocol ${np}; check the target network supports it`, before: String(op), after: String(np) });
  } else if (op !== np || o.envMeta.preRelease !== n.envMeta.preRelease) {
    out.push({ severity: "info", rule: "meta-changed", path: "env protocol", message: "environment version changed", before: `${op}.${o.envMeta.preRelease}`, after: `${np}.${n.envMeta.preRelease}` });
  }

  for (const key of new Set([...Object.keys(o.meta), ...Object.keys(n.meta)])) {
    const a = o.meta[key];
    const b = n.meta[key];
    if (a !== b) {
      out.push({ severity: "info", rule: "meta-changed", path: `meta ${key}`, message: a === undefined ? "added" : b === undefined ? "removed" : "changed", before: a, after: b });
    }
  }
}

// ------------------------------------------------------------------ helpers

function byName<T extends { name: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((x) => [x.name, x]));
}

/** For each custom type, the functions that reach it directly or through other types. */
function usedBy(i: ContractInterface): Map<string, string[]> {
  const typeRefs = new Map(i.types.map((t) => [t.name, t.refs]));
  const result = new Map<string, Set<string>>();
  for (const fn of i.functions) {
    const seen = new Set<string>();
    const stack = [...fn.refs];
    while (stack.length) {
      const t = stack.pop()!;
      if (seen.has(t)) continue;
      seen.add(t);
      stack.push(...(typeRefs.get(t) ?? []));
    }
    for (const t of seen) {
      if (!result.has(t)) result.set(t, new Set());
      result.get(t)!.add(fn.name);
    }
  }
  return new Map([...result].map(([k, v]) => [k, [...v].sort()]));
}

function mergeUsage(a: Map<string, string[]>, b: Map<string, string[]>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    out.set(k, [...new Set([...(a.get(k) ?? []), ...(b.get(k) ?? [])])].sort());
  }
  return out;
}
