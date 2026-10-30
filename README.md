# OpavoLabs

Tamper-evident lab equipment checkout on Tezos Shadownet: photo evidence on IPFS, SHA-256 hash on-chain, two-party approval enforced by a contract state machine, refundable deposits.

- Spec and workflow: see the build spec (team doc). Contract interface: `contracts/INTERFACE.md`.
- Contract: `contracts/opavolabs.py` (SmartPy). Run tests in the SmartPy IDE or `python contracts/opavolabs.py`.
- Frontend: `frontend/` (Vite + React + Tailwind). Offline sandbox: `VITE_MOCK=1 npm run dev`.
- Lib tests (no network needed): `cd frontend && node --test tests/lib.test.js`.
- Today's plan: `docs/TODAY-3H-PLAN.md`.

Known limitations: a hash proves a photo was not changed later, not that it was honest at capture; no return deadline yet.
Powered by TzKT API (tzkt.io).
