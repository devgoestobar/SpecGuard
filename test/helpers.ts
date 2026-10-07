import type { ContractInterface, CustomType, Fn } from "../src/model.ts";

export function fn(name: string, inputs: [string, string][] = [], output = "()", extra: Partial<Fn> = {}): Fn {
  const refs = [...inputs.map(([, t]) => t), output].filter((t) => /^[A-Z]/.test(t) && !["Address", "String", "Symbol", "Bytes"].includes(t));
  return { name, doc: "", inputs: inputs.map(([n, t]) => ({ name: n, type: t })), output, refs, ...extra };
}

export function iface(parts: { functions?: Fn[]; types?: CustomType[]; meta?: Record<string, string>; protocol?: number } = {}): ContractInterface {
  return {
    source: "test",
    wasmHash: "0".repeat(64),
    functions: parts.functions ?? [],
    types: parts.types ?? [],
    meta: parts.meta ?? {},
    envMeta: { protocol: parts.protocol ?? 27, preRelease: 0 },
  };
}
