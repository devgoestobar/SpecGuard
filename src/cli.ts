#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { compare } from "./compare/diff.ts";
import { interfaceFromWasm } from "./extract/spec.ts";
import { loadWasm } from "./extract/source.ts";
import { renderText } from "./report/text.ts";

const USAGE = `Usage: specguard diff <old> <new> [options]

Compare the public interface of two Soroban contract versions.
<old> and <new> can each be a .wasm file, a contract id (C...) or a Wasm hash.

Options:
  --format <text|json>     Output format (default: text)
  --out <file>             Also write the JSON report to a file
  --fail-on <breaking|risky>
                           Lowest severity that fails the run (default: breaking)
  --network <name>         testnet or futurenet, for contract ids and hashes
  --rpc-url <url>          RPC endpoint, overrides --network (needed for mainnet)
  --no-color               Plain text output
  -h, --help               Show this help

Exit codes:
  0  passed
  1  changes at or above --fail-on found
  2  invalid input or runtime error
`;

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      format: { type: "string", default: "text" },
      out: { type: "string" },
      "fail-on": { type: "string", default: "breaking" },
      network: { type: "string" },
      "rpc-url": { type: "string" },
      "no-color": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help || positionals.length === 0) {
    process.stdout.write(USAGE);
    return 0;
  }

  const [command, oldArg, newArg, ...rest] = positionals;
  if (command !== "diff") return usageError(`unknown command: ${command}`);
  if (!oldArg || !newArg || rest.length) return usageError("diff takes exactly two arguments");
  if (values.format !== "text" && values.format !== "json") return usageError(`unknown format: ${values.format}`);
  if (values["fail-on"] !== "breaking" && values["fail-on"] !== "risky") return usageError(`--fail-on must be breaking or risky`);

  const opts = { network: values.network, rpcUrl: values["rpc-url"] };
  const [a, b] = await Promise.all([loadWasm(oldArg, opts), loadWasm(newArg, opts)]);
  const report = compare(interfaceFromWasm(a.wasm, a.label), interfaceFromWasm(b.wasm, b.label));
  const json = JSON.stringify(report, null, 2) + "\n";

  if (values.out) await writeFile(values.out, json);
  if (values.format === "json") {
    process.stdout.write(json);
  } else {
    const color = !values["no-color"] && !process.env.NO_COLOR && process.stdout.isTTY === true;
    process.stdout.write(renderText(report, color));
  }

  const failing = values["fail-on"] === "risky" ? report.verdict !== "compatible" : report.verdict === "breaking";
  return failing ? 1 : 0;
}

function usageError(message: string): number {
  process.stderr.write(`error: ${message}\n\n${USAGE}`);
  return 2;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 2;
  },
);
