import type { Change, Report } from "../model.ts";

// GitHub-flavoured markdown, used for job summaries and PR comments.
export function renderMarkdown(r: Report): string {
  const s = r.summary;
  const lines = [
    `### SpecGuard: ${r.verdict}`,
    "",
    `| | Source | Wasm hash |`,
    `|---|---|---|`,
    `| old | ${code(r.old.source)} | ${code(r.old.wasmHash.slice(0, 16))} |`,
    `| new | ${code(r.new.source)} | ${code(r.new.wasmHash.slice(0, 16))} |`,
    "",
    `${s.breaking} breaking, ${s.risky} risky, ${s.compatible} compatible, ${s.info} info`,
    "",
  ];

  if (r.changes.length === 0) {
    lines.push("No interface changes.");
  } else {
    lines.push("| Severity | Where | Change | Detail |", "|---|---|---|---|");
    for (const c of r.changes) {
      lines.push(`| ${c.severity} | ${code(c.path)} | ${esc(c.message)} | ${detail(c)} |`);
    }
  }
  return lines.join("\n") + "\n";
}

function detail(c: Change): string {
  const parts: string[] = [];
  if (c.before !== undefined && c.after !== undefined) parts.push(`${code(c.before)} → ${code(c.after)}`);
  else if (c.before !== undefined) parts.push(`was ${code(c.before)}`);
  else if (c.after !== undefined) parts.push(code(c.after));
  if (c.usedBy?.length) parts.push(`used by ${c.usedBy.map(code).join(", ")}`);
  return parts.join("<br>");
}

function code(s: string): string {
  return "`" + s.replace(/`/g, "'").replace(/\|/g, "\\|") + "`";
}

function esc(s: string): string {
  return s.replace(/\|/g, "\\|");
}
