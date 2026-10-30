# Your 3 hours (solo, before the team joins)

Goal at T+3:00: contract live on Shadownet, one real checkout working end-to-end, repo pushed, team can start on UI immediately.
Rule: if a block overruns by 15 min, take the fallback and move on.

## 0:00-0:25  Accounts and tools (spec Phase 0)
- [ ] `node -v` (22+), Git, Chrome. Temple extension, Testnet mode ON, then display options -> Filter by network -> Shadownet, 3 accounts: Admin, StudentA, StudentB. Second Chrome profile for the student.
- [ ] Faucet https://faucet.shadownet.teztnets.com: fund Admin generously, students 20+ tez each. Do this FIRST, faucets throttle.
- [ ] REVEAL each new account: from each of the 3 accounts, send 1 tez to any other account in Temple. A new account cannot use dApps until it has sent one transaction (Tezos docs).
- [ ] Pinata account -> JWT + gateway domain into your password manager. Vercel: sign up with GitHub.
- [ ] GitHub repo `opavolabs` (private), add teammates.

## 0:25-0:50  Repo and frontend scaffold (Phase 1)
```bash
cd opavolabs            # this folder, unzipped
mkdir /tmp/scaf && cd /tmp/scaf && npm create vite@latest frontend -- --template react
cd frontend && npm install
npm i react-router-dom @taquito/taquito @taquito/utils @taquito/beacon-wallet @tezos-x/octez.connect-types qrcode pinata
npm i -D tailwindcss @tailwindcss/vite buffer events vite-compatible-readable-stream
# copy scaffold into the repo WITHOUT overwriting our files:
cp -rn /tmp/scaf/frontend/. <repo>/frontend/
```
- [ ] `vite.config.js` and `index.html` already follow the official Tezos docs setup (no polyfill plugin).
- [ ] `npm run dev` works; `node --test tests/lib.test.js` still 7/7.
- [ ] Add a route `/dev` -> `pages/Dev.jsx` in App.jsx (hash router).
- [ ] Push to GitHub. Post `contracts/INTERFACE.md` in chat: "frozen".

## 0:50-1:35  CONTRACT (the critical path, spec 2A)
- [ ] Open https://smartpy.io/ide, paste `contracts/opavolabs.py`, run tests.
- [ ] I could not compile it (no network here). Expect a few syntax fixes. Paste each error into the AI with "use current SmartPy syntax, check smartpy.tezos.com". Most likely spots: nested assignment `self.data.loans[id].status = ...`, `sp.cast(None, sp.option[...])`, `sp.test_scenario(name, main)`.
- [ ] All scenarios green -> screenshot into `docs/demo-evidence.md`.
- [ ] Deploy (IDE origination, Shadownet, admin = your Admin address). Copy KT1.
- [ ] Smoke test: `register_equipment("Test item", 5000000)`; confirm key 0 on api.shadownet.tzkt.io.
- Fallback if tests are stuck at 1:20: deploy with the P0 entrypoints only (drop reject_return), keep going.

## 1:35-2:15  Integration modules live (spec 2C)
- [ ] `.env.local`: VITE_CONTRACT, VITE_PINATA_GATEWAY, VITE_MOCK=0; Vercel env or local `.env` for PINATA_JWT/PINATA_GATEWAY.
- [ ] `vercel dev` in `frontend/`. On /dev: Connect shows address+balance; Compress+hash matches `sha256sum`; Upload returns a CID that opens at the gateway; List equipment shows the Test item; Verify green, Simulate red.
- [ ] Never paste the JWT into any AI chat.

## 2:15-2:50  First real end-to-end (spec 3.1-3.3)
- [ ] Real chain.js is written. Minimal check: from /dev (or browser console via a temp button) call requestCheckout as StudentA with a real photo, approveCheckout as Admin (second profile). Mismatched param names are bug #1, compare against INTERFACE.md.
- [ ] Then return + approveReturn with 1 tez penalty; confirm balances in Temple.
- [ ] `git tag v0.1-e2e`, push.

## 2:50-3:00  Handoff
- [ ] Post in team chat: contract address, repo link, "VITE_MOCK=1 npm run dev" works for UI, assignments (Role 1 reviews/extends contract tests, Role 2 builds pages against chain.mock.js, you own lib/ + deploy).
- [ ] Update `.env.example` with the KT1 address.

## What I already did for you (so the blocks above are short)
Contract + 10 test scenarios, frozen INTERFACE.md, errors/hash/image/ipfs/verify/tezos/tzkt libs, chain.mock.js and chain.real.js and chain.js switch, upload-url function, /dev page, and 7 passing Node tests.
## What is NOT verified
Contract compile (SmartPy not installable offline), Taquito/Pinata/Beacon calls, Vite build. These are the first things you will exercise.
