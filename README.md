# SpecGuard

Interface compatibility checker for Soroban contracts.

A Soroban contract can replace its Wasm and keep the same address. That is
convenient, but the new code can quietly change the public interface: a
removed function, a different argument type, a changed struct. Apps, generated
bindings and other contracts that call it then break after the upgrade.

SpecGuard compares the contract spec embedded in two Wasm builds (or two
deployed contracts) and reports every interface change as **breaking**,
**risky** or **compatible**. It exits non-zero on breaking changes, so it can
gate a release in CI.

> Status: early development. The CLI below is the target interface.

## Usage

```sh
specguard diff old.wasm new.wasm
specguard diff old.wasm new.wasm --format json > report.json
```

| Exit code | Meaning |
|---|---|
| 0 | No breaking changes |
| 1 | Breaking changes found |
| 2 | Invalid input or runtime error |

## What it checks

Functions, arguments, return types, custom types (structs, unions, enums),
error enums and contract metadata, all read from the `contractspecv0`,
`contractmetav0` and `contractenvmetav0` sections of the Wasm.

## What it does not check

- Storage layout or data migrations
- Business logic or security issues
- It never signs, submits or executes an upgrade

A clean report means the callable interface did not break. It does not mean
the upgrade is safe in every other respect.

## Development

Requires Node.js 22.18 or newer.

```sh
npm install
npm test
npm run build
```

## License

MIT
