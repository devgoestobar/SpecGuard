#!/usr/bin/env node
import { parseArgs } from "node:util";

const USAGE = `Usage: specguard diff <old> <new> [options]

Compare the public interface of two Soroban contract versions.
<old> and <new> are paths to .wasm files.

Options:
  --format <text|json>   Output format (default: text)
  -h, --help             Show this help

Exit codes:
  0  no breaking changes
  1  breaking changes found
  2  invalid input or runtime error
`;

function main(argv: string[]): number {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      format: { type: "string", default: "text" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help || positionals.length === 0) {
    process.stdout.write(USAGE);
    return 0;
  }

  const [command] = positionals;
  if (command !== "diff") {
    process.stderr.write(`Unknown command: ${command}\n\n${USAGE}`);
    return 2;
  }

  process.stderr.write("diff: not implemented yet\n");
  return 2;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (err) {
  process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 2;
}
