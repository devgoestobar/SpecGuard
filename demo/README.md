# Demo: SpecGuard on pull requests

`demo/contracts/vault` is the example vault contract, version 1. It is deployed
on testnet as
[`CAWFWCMUQVA2GXHLNDWZHKIPENH6ULOL2MR7G3PDDQOHBWSBRTYXTFS6`](https://stellar.expert/explorer/testnet/contract/CAWFWCMUQVA2GXHLNDWZHKIPENH6ULOL2MR7G3PDDQOHBWSBRTYXTFS6).

Any pull request that touches `demo/` runs
[.github/workflows/demo.yml](../.github/workflows/demo.yml): it builds the
contract and compares its interface with that deployment. A change that would
break existing callers fails the check and blocks the pull request.
