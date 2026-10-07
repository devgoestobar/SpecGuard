// Normalized view of a contract interface, independent of the XDR shapes.
// Both sides of a comparison are reduced to this before any rule runs.

export type Severity = "breaking" | "risky" | "compatible" | "info";

export interface ContractInterface {
  source: string;
  functions: unknown[];
  types: unknown[];
  errors: unknown[];
  events: unknown[];
  meta: Record<string, string>;
  envMeta: Record<string, string>;
}

export interface Change {
  severity: Severity;
  rule: string;
  path: string;
  message: string;
  before?: string;
  after?: string;
}

export interface Report {
  old: string;
  new: string;
  verdict: Severity;
  summary: Record<Severity, number>;
  changes: Change[];
}
