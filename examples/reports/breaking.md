### SpecGuard: breaking

| | Source | Wasm hash |
|---|---|---|
| old | `vault_v1.wasm` | `6be7f445d4c003d3` |
| new | `vault_v2_breaking.wasm` | `7cc398bca002ea93` |

5 breaking, 0 risky, 0 compatible, 0 info

| Severity | Where | Change | Detail |
|---|---|---|---|
| breaking | `fn deposit(amount)` | argument type changed | `i128` → `u64` |
| breaking | `fn position` | return type changed | `Option<Position>` → `Position` |
| breaking | `fn last_action` | function removed | was `last_action(owner: Address) -> Option<Action>` |
| breaking | `struct Position.fee` | field added | + `i128`<br>used by `position` |
| breaking | `error VaultError::NotFound` | error code changed | `1` → `10`<br>used by `deposit`, `withdraw` |
