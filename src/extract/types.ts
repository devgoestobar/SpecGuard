// Spec types arrive as XDR-JSON: primitives are strings ("i128"), the rest are
// single-key objects ({ "option": { "value_type": ... } }). Rendering them in
// Rust syntax gives a stable string to compare and something readable to show.

type Json = string | number | { [key: string]: any };

const PRIMITIVES: Record<string, string> = {
  val: "Val",
  bool: "bool",
  void: "()",
  error: "Error",
  timepoint: "Timepoint",
  duration: "Duration",
  bytes: "Bytes",
  string: "String",
  symbol: "Symbol",
  address: "Address",
  muxed_address: "MuxedAddress",
};

export function renderType(t: Json): string {
  if (typeof t === "string") return PRIMITIVES[t] ?? t;
  if (typeof t !== "object" || t === null) return String(t);
  if ("option" in t) return `Option<${renderType(t.option.value_type)}>`;
  if ("result" in t) return `Result<${renderType(t.result.ok_type)}, ${renderType(t.result.error_type)}>`;
  if ("vec" in t) return `Vec<${renderType(t.vec.element_type)}>`;
  if ("map" in t) return `Map<${renderType(t.map.key_type)}, ${renderType(t.map.value_type)}>`;
  if ("tuple" in t) return `(${t.tuple.value_types.map(renderType).join(", ")})`;
  if ("bytes_n" in t) return `BytesN<${t.bytes_n.n}>`;
  if ("udt" in t) return t.udt.name;
  return JSON.stringify(t);
}

/** Names of all custom types referenced anywhere inside a type. */
export function collectRefs(t: Json, out: Set<string> = new Set()): Set<string> {
  if (typeof t !== "object" || t === null) return out;
  if ("udt" in t) {
    out.add(t.udt.name);
    return out;
  }
  for (const v of Object.values(t)) {
    if (Array.isArray(v)) v.forEach((x) => collectRefs(x, out));
    else collectRefs(v, out);
  }
  return out;
}
