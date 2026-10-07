# Compatibility rules

SpecGuard reads the contract spec (`contractspecv0`) and metadata
(`contractmetav0`, `contractenvmetav0`) from two Wasm builds and compares them.
Every difference becomes a change with one of four severities:

| Severity | Meaning | Exit code |
|---|---|---|
| `breaking` | Existing callers or decoders will fail, or silently get a different meaning | 1 |
| `risky` | On-chain calls keep working, but some clients may break (generated bindings, code that matches on values) | 0 |
| `compatible` | Additive change, nothing existing is affected | 0 |
| `info` | No effect on callers (docs, build metadata) | 0 |

The overall result is the highest severity found. `--fail-on risky` makes risky
changes fail the run too.

## Why the rules look like this

The rules follow how the Soroban SDK encodes values, which decides what an old
caller can still send and decode:

- **Function arguments** are passed by position. Names are not sent on-chain,
  but generated bindings (TypeScript in particular) use them.
- **Structs with named fields** are a map keyed by field name. Decoding requires
  exactly the same set of keys, so adding or removing a field breaks both sides.
  Field order in the spec does not matter.
- **Tuple structs** are a vector of fixed length. Order and count matter.
- **Unions** (`enum` with data) are a vector whose first element is the case
  name as a symbol. Old decoders reject case names they do not know.
- **Integer enums** and **error enums** are a `u32`. The number is what travels;
  the name only exists in the spec and in bindings.
- **`Option<T>`** is `T` when present and void when absent, so an old caller
  that always sends `T` is still valid input for `Option<T>`.

## Functions

| Rule | Change | Severity |
|---|---|---|
| `fn-removed` | Function removed | breaking |
| `fn-added` | Function added | compatible |
| `fn-input-count` | Number of arguments changed | breaking |
| `fn-input-type` | Argument type changed | breaking |
| `fn-input-optional` | Argument type `T` became `Option<T>` | risky |
| `fn-input-reordered` | Arguments of the same type swapped position | breaking |
| `fn-input-renamed` | Argument renamed, same type and position | risky |
| `fn-output-type` | Return type changed | breaking |
| `fn-doc` | Doc comment changed | info |

`__constructor` only runs when a contract is deployed; an upgrade never calls
it. Changes to it are reported as `info`.

Types are compared by their rendered form (`Option<Position>`,
`Result<i128, VaultError>`, `BytesN<32>`). A reference to a custom type compares
by name; changes inside that type are reported once, on the type itself, with
the functions that use it.

## Custom types

| Rule | Change | Severity |
|---|---|---|
| `type-removed` | Type removed while a function used it | breaking |
| `type-removed-unused` | Type removed, no function used it | info |
| `type-added` | Type added | compatible |
| `type-kind` | Type changed kind (e.g. struct to union) | breaking |
| `type-doc` | Doc comment changed | info |
| `struct-field-added` | Field added | breaking |
| `struct-field-removed` | Field removed | breaking |
| `struct-field-type` | Field type changed | breaking |
| `union-case-added` | Case added | risky |
| `union-case-removed` | Case removed | breaking |
| `union-case-type` | Case payload changed | breaking |
| `enum-case-added` | Value added | risky |
| `enum-case-removed` | Value removed | breaking |
| `enum-value-changed` | Same name, different number | breaking |
| `enum-case-renamed` | Same number, different name | risky |

`type-removed-unused` exists because newer SDKs drop types from the spec when
no function or event uses them, so a type vanishing on its own is not a
breaking change.

Added cases are `risky` rather than `compatible`: an old client that reads the
value back (a return value, a stored struct) cannot decode the new case.

## Errors

| Rule | Change | Severity |
|---|---|---|
| `error-added` | Error code added | compatible |
| `error-removed` | Error code removed | risky |
| `error-code-changed` | Same name, different code | breaking |
| `error-renamed` | Same code, different name | info |

## Metadata

| Rule | Change | Severity |
|---|---|---|
| `env-protocol` | Contract now requires a newer protocol version | risky |
| `meta-changed` | Build metadata changed (SDK, compiler, custom keys) | info |

## Not checked

- Storage layout, storage keys and data migration
- Events
- Behaviour, authorization and business logic

A run with no breaking changes means the callable interface still matches. It
does not mean the upgrade is safe in every other respect.
