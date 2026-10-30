# Audit of the first scaffold (30 Oct 2026)
Checked against live docs (docs.tezos.com, teztnets.com, docs.pinata.cloud, smartpy.tezos.com) and by running the Node tests.

## Confirmed correct
Shadownet RPC `rpc.shadownet.teztnets.com`; faucet `faucet.shadownet.teztnets.com`; TzKT API `api.shadownet.tzkt.io` (used in Trilitech tutorials); Temple "Testnet mode"; Pinata `createSignedURL` + `.file(f).url(u)` + `upload.cid`; SmartPy `sp.test_scenario("name", main)`, `_sender/_amount/_valid/_exception`, `c.balance`.

## Errors found and fixed
1. I said the contract had 10 test scenarios; it had 9. Now genuinely 10 (split a test that built two scenarios).
2. `@airgap/beacon-types` is the old package name; current Tezos docs use `@tezos-x/octez.connect-types`. Fixed in tezos.js and install command.
3. Docs require ONE BeaconWallet instance; my connect() made a new one each call. Fixed. Added the documented IndexedDB init workaround and `wallet.client.clearActiveAccount()`.
4. chain.js used top-level await, which can fail `npm run build`. Replaced with static imports.
5. /dev page had no write actions, but the plan relied on it for the first real checkout. Now a full control panel.
6. New accounts must be "revealed" (send 1 tez once). Missing from plan. Added.
7. Upload function now restricts to images under 2 MB.
8. TezosToolkit now has a default RPC so mock mode cannot crash on a missing env var.

9. Second audit: I had told the user to use `vite-plugin-node-polyfills`; the official Tezos docs prescribe a different Vite setup (octez.connect-types alias, buffer/events/vite-compatible-readable-stream, index.html global+Buffer scripts). Switched to the official setup; vite.config.js and index.html are now in the repo.
10. ipfs.js built the Pinata client at page load; now lazy so a bad env var cannot blank the /dev page.

## Still unverified (cannot be checked offline)
- Contract compiles in SmartPy (mutez subtraction `deposit - penalty`, nested big_map assignment, `sp.cast(None, ...)`).
- Taquito `methods`/`methodsObject` call style against the deployed contract; Vite build; Pinata signed upload from a browser.
- Explorer URL for tx links (`VITE_EXPLORER_BASE`): confirm by opening any op on TzKT.
