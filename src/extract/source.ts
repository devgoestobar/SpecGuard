// Resolves a CLI argument to Wasm bytes: a local file, a deployed contract id,
// or a Wasm hash already uploaded to the network. Network access is read-only.

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { rpc } from "@stellar/stellar-sdk";

export const RPC_URLS: Record<string, string> = {
  testnet: "https://soroban-testnet.stellar.org",
  futurenet: "https://rpc-futurenet.stellar.org",
};

export interface Loaded {
  wasm: Uint8Array<ArrayBuffer>;
  label: string;
}

const CONTRACT_ID = /^C[A-Z2-7]{55}$/;
const WASM_HASH = /^[0-9a-f]{64}$/i;

export async function loadWasm(arg: string, opts: { network?: string; rpcUrl?: string }): Promise<Loaded> {
  if (CONTRACT_ID.test(arg) || WASM_HASH.test(arg)) {
    const server = new rpc.Server(rpcUrl(opts), { allowHttp: opts.rpcUrl?.startsWith("http://") ?? false });
    const bytes = CONTRACT_ID.test(arg)
      ? await server.getContractWasmByContractId(arg)
      : await server.getContractWasmByHash(arg, "hex");
    return { wasm: new Uint8Array(bytes), label: `${opts.network ?? "rpc"}:${arg}` };
  }
  const bytes = await readFile(arg).catch(() => {
    throw new Error(`cannot read ${arg}`);
  });
  return { wasm: new Uint8Array(bytes), label: basename(arg) };
}

function rpcUrl(opts: { network?: string; rpcUrl?: string }): string {
  if (opts.rpcUrl) return opts.rpcUrl;
  const url = opts.network ? RPC_URLS[opts.network] : undefined;
  if (url) return url;
  if (opts.network) throw new Error(`no default RPC for network "${opts.network}", pass --rpc-url`);
  throw new Error("a contract id or Wasm hash needs --network or --rpc-url");
}
