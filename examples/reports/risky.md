### SpecGuard: risky

| | Source | Wasm hash |
|---|---|---|
| old | `vault_v1.wasm` | `6be7f445d4c003d3` |
| new | `vault_v2_risky.wasm` | `51c2a2b025302114` |

0 breaking, 4 risky, 0 compatible, 0 info

| Severity | Where | Change | Detail |
|---|---|---|---|
| risky | `fn withdraw(to)` | argument renamed | `to` → `recipient` |
| risky | `union Action::Claim` | case added; old clients cannot decode it | used by `last_action` |
| risky | `enum Status::Closed` | value added; old clients cannot decode it | + `2`<br>used by `status` |
| risky | `error VaultError::Paused` | error code removed | was `3`<br>used by `deposit`, `withdraw` |
