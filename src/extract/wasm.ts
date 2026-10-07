// Soroban keeps the contract interface and metadata in Wasm custom sections.
// WebAssembly.Module validates the binary and exposes those sections without
// instantiating anything, so no contract code ever runs.

export const SPEC_SECTION = "contractspecv0";
export const META_SECTION = "contractmetav0";
export const ENV_META_SECTION = "contractenvmetav0";

export function readCustomSection(wasm: Uint8Array<ArrayBuffer>, name: string): Uint8Array | undefined {
  const mod = new WebAssembly.Module(wasm);
  const sections = WebAssembly.Module.customSections(mod, name);
  if (sections.length === 0) return undefined;
  // A well-formed contract has at most one of each; concatenate defensively.
  const parts = sections.map((s) => new Uint8Array(s));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
