### SpecGuard: compatible

| | Source | Wasm hash |
|---|---|---|
| old | `vault_v1.wasm` | `6be7f445d4c003d3` |
| new | `vault_v2_compatible.wasm` | `da68f2e06c15076c` |

0 breaking, 0 risky, 2 compatible, 1 info

| Severity | Where | Change | Detail |
|---|---|---|---|
| compatible | `fn balance` | function added | + `balance(owner: Address) -> i128` |
| compatible | `error VaultError::Locked` | error code added | + `4`<br>used by `deposit`, `withdraw` |
| info | `fn deposit` | doc comment changed |  |
