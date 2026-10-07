import { createHash } from "node:crypto";
import { xdr } from "@stellar/stellar-sdk";
import type { ContractInterface, CustomType, Fn } from "../model.ts";
import { ENV_META_SECTION, META_SECTION, SPEC_SECTION, readCustomSection } from "./wasm.ts";
import { collectRefs, renderType } from "./types.ts";

export function interfaceFromWasm(wasm: Uint8Array<ArrayBuffer>, source: string): ContractInterface {
  const specBytes = readCustomSection(wasm, SPEC_SECTION);
  if (!specBytes) {
    throw new Error(`${source}: no ${SPEC_SECTION} section, not a Soroban contract or built without a spec`);
  }

  const functions: Fn[] = [];
  const types: CustomType[] = [];

  for (const entry of xdr.decodeStream(xdr.ScSpecEntry, specBytes)) {
    const json = entry.toJSON() as Record<string, any>;
    const [kind] = Object.keys(json);
    const e = json[kind!];

    switch (kind) {
      case "function_v0":
        functions.push({
          name: e.name,
          doc: e.doc,
          inputs: e.inputs.map((i: any) => ({ name: i.name, type: renderType(i.type) })),
          output: e.outputs.length ? renderType(e.outputs[0]) : "()",
          refs: [...collectRefs({ inputs: e.inputs.map((i: any) => i.type), outputs: e.outputs })],
        });
        break;
      case "udt_struct_v0":
        types.push({
          kind: "struct",
          name: e.name,
          doc: e.doc,
          fields: e.fields.map((f: any) => ({ name: f.name, type: renderType(f.type) })),
          refs: [...collectRefs(e.fields.map((f: any) => f.type))],
        });
        break;
      case "udt_union_v0":
        types.push({
          kind: "union",
          name: e.name,
          doc: e.doc,
          cases: e.cases.map((c: any) =>
            "tuple_v0" in c
              ? { name: c.tuple_v0.name, types: c.tuple_v0.type.map(renderType) }
              : { name: c.void_v0.name, types: [] },
          ),
          refs: [...collectRefs(e.cases)],
        });
        break;
      case "udt_enum_v0":
      case "udt_error_enum_v0":
        types.push({
          kind: kind === "udt_enum_v0" ? "enum" : "error",
          name: e.name,
          doc: e.doc,
          cases: e.cases.map((c: any) => ({ name: c.name, value: c.value })),
          refs: [],
        });
        break;
      // Events are not part of the compared interface.
    }
  }

  const meta: Record<string, string> = {};
  const metaBytes = readCustomSection(wasm, META_SECTION);
  if (metaBytes) {
    for (const entry of xdr.decodeStream(xdr.ScMetaEntry, metaBytes)) {
      const { key, val } = (entry.toJSON() as any).sc_meta_v0;
      meta[key] = val;
    }
  }

  const envMeta: ContractInterface["envMeta"] = {};
  const envBytes = readCustomSection(wasm, ENV_META_SECTION);
  if (envBytes) {
    for (const entry of xdr.decodeStream(xdr.ScEnvMetaEntry, envBytes)) {
      const v = (entry.toJSON() as any).sc_env_meta_kind_interface_version;
      if (v) {
        envMeta.protocol = v.protocol;
        envMeta.preRelease = v.pre_release;
      }
    }
  }

  const wasmHash = createHash("sha256").update(wasm).digest("hex");
  return { source, wasmHash, functions, types, meta, envMeta };
}
