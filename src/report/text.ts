import type { Report, Severity } from "../model.ts";

const LABEL: Record<Severity, string> = {
  breaking: "BREAKING",
  risky: "RISKY",
  compatible: "OK",
  info: "info",
};

const COLOR: Record<Severity, string> = {
  breaking: "\x1b[31m",
  risky: "\x1b[33m",
  compatible: "\x1b[32m",
  info: "\x1b[2m",
};

export function renderText(r: Report, color: boolean): string {
  const paint = (s: Severity, text: string) => (color ? `${COLOR[s]}${text}\x1b[0m` : text);
  const dim = (text: string) => (color ? `\x1b[2m${text}\x1b[0m` : text);
  const lines: string[] = [];

  const width = Math.max(r.old.source.length, r.new.source.length);
  lines.push(`old  ${r.old.source.padEnd(width)}  ${dim(short(r.old.wasmHash))}`);
  lines.push(`new  ${r.new.source.padEnd(width)}  ${dim(short(r.new.wasmHash))}`);
  lines.push("");

  if (r.changes.length === 0) {
    lines.push("no interface changes");
  } else {
    const pathWidth = Math.min(36, Math.max(...r.changes.map((c) => c.path.length)));
    for (const c of r.changes) {
      lines.push(`${paint(c.severity, LABEL[c.severity].padEnd(9))} ${c.path.padEnd(pathWidth)}  ${c.message}`);
      const detail = c.before !== undefined && c.after !== undefined ? `${c.before} -> ${c.after}` : c.before !== undefined ? `- ${c.before}` : c.after !== undefined ? `+ ${c.after}` : undefined;
      if (detail) lines.push(dim(`${" ".repeat(10)}${detail}`));
      if (c.usedBy?.length) {
        lines.push(dim(`${" ".repeat(10)}used by ${c.usedBy.join(", ")}`));
      }
    }
  }

  const s = r.summary;
  lines.push("");
  lines.push(`${s.breaking} breaking, ${s.risky} risky, ${s.compatible} compatible, ${s.info} info`);
  lines.push(`result: ${paint(r.verdict, r.verdict)}`);
  return lines.join("\n") + "\n";
}

function short(hash: string): string {
  return `${hash.slice(0, 8)}..${hash.slice(-4)}`;
}
