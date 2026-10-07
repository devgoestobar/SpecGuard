// Normalized view of a contract interface, independent of the XDR shapes.
// Both sides of a comparison are reduced to this before any rule runs.
// Types are kept as their rendered form (`Option<Position>`), which is what
// rules compare and what reports show.

export type Severity = "breaking" | "risky" | "compatible" | "info";

export const SEVERITIES: readonly Severity[] = ["breaking", "risky", "compatible", "info"];

export interface Param {
  name: string;
  type: string;
}

export interface Fn {
  name: string;
  doc: string;
  inputs: Param[];
  output: string;
  /** Custom types referenced directly by the signature. */
  refs: string[];
}

export interface StructType {
  kind: "struct";
  name: string;
  doc: string;
  fields: Param[];
  refs: string[];
}

export interface UnionType {
  kind: "union";
  name: string;
  doc: string;
  cases: { name: string; types: string[] }[];
  refs: string[];
}

export interface EnumType {
  kind: "enum" | "error";
  name: string;
  doc: string;
  cases: { name: string; value: number }[];
  refs: string[];
}

export type CustomType = StructType | UnionType | EnumType;

export interface ContractInterface {
  source: string;
  wasmHash: string;
  functions: Fn[];
  types: CustomType[];
  meta: Record<string, string>;
  envMeta: { protocol?: number; preRelease?: number };
}

export interface Change {
  severity: Severity;
  rule: string;
  /** Where the change is, e.g. `fn deposit(amount)` or `struct Position.fee`. */
  path: string;
  message: string;
  before?: string;
  after?: string;
  /** Functions affected through a custom type. */
  usedBy?: string[];
}

export interface Report {
  schema: 1;
  old: { source: string; wasmHash: string };
  new: { source: string; wasmHash: string };
  verdict: Exclude<Severity, "info">;
  summary: Record<Severity, number>;
  changes: Change[];
}
