# OpavoLabs

**Tamper-evident lab equipment checkout on Tezos Shadownet**

OpavoLabs brings cryptographic accountability to shared lab equipment. Every handover requires dual approval from student and admin, backed by on-chain SHA-256 photo fingerprints, IPFS image storage, and refundable tez deposits held in smart contract escrow.

- **Live Production URL:** [https://opavo-labs.vercel.app](https://opavo-labs.vercel.app)
- **Deployed Contract (Shadownet):** [`KT1T7x8SLXrc8b9wPLKTtGLFWUDAbnBxxYd6`](https://shadownet.tzkt.io/KT1T7x8SLXrc8b9wPLKTtGLFWUDAbnBxxYd6)
- **Admin Address:** `tz1TanXJGm4Sdz9ZFzMNsAwf9jBaVvT1iqiB`
- **Network:** Tezos Shadownet (Ghostnet protocol)
- **Contract Interface:** [`contracts/INTERFACE.md`](contracts/INTERFACE.md)
- **SmartPy Contract:** [`contracts/opavolabs.py`](contracts/opavolabs.py)

---

## How It Works

1. **Equipment Registration (Admin)**: Lab admin registers equipment with a refundable deposit requirement in tez.
2. **Checkout Request (Student)**:
   - Student captures a condition photo of the equipment via camera/file.
   - The photo is compressed and fingerprinted with SHA-256 directly in the browser.
   - The photo is uploaded to IPFS via Pinata signed upload URLs (private JWT never reaches the client).
   - Student signs the request transaction in Temple wallet, locking the refundable deposit in the contract escrow.
3. **Checkout Approval (Admin)**:
   - Admin reviews the request, pulls the photo from IPFS, and re-computes the SHA-256 fingerprint.
   - The app verifies that the retrieved photo matches the recorded on-chain fingerprint character for character.
   - Admin signs the approval transaction. Loan status becomes `ACTIVE`.
4. **Return Request (Student)**:
   - Student captures a return photo showing condition at return.
   - Return photo is uploaded to IPFS and its SHA-256 hash is recorded on-chain.
5. **Return Approval & Refund (Admin)**:
   - Admin inspects the return photo and fingerprint match.
   - Admin approves with zero penalty. The contract automatically releases the 100% deposit refund back to the student.
6. **Tamper-Evident Verification**:
   - Universal verification page where anyone can drop an image file, compute its SHA-256 hash in browser, and compare it against any on-chain checkout or return record.
   - Includes real-time character-diff highlighting and decentralized IPFS re-fetching.
   - *Honest note:* A cryptographic match proves the file is unchanged since it was recorded. It does not prove the photo was truthful at capture.

---

## Tech Stack

- **Smart Contract:** SmartPy (`opavolabs.py`), compiled and deployed to Tezos Shadownet.
- **Frontend:** React 19, Vite 7, Tailwind CSS v4, Lucide React.
- **Tezos Integration:** `@taquito/taquito`, `@taquito/beacon-wallet`, `@tezos-x/octez.connect-types`.
- **Decentralized Storage:** Pinata IPFS SDK with serverless signed upload endpoints.
- **Blockchain Indexer:** TzKT REST API for real-time reads and transaction receipts.
- **Design System:** Coinbase-inspired DESIGN.md guidelines (Inter typography, semantic verified green / mismatch red, clean border-based depth).

---

## Project Structure

```
├── contracts/
│   ├── opavolabs.py          # SmartPy contract implementation + tests
│   └── INTERFACE.md          # Frozen contract ABI & entrypoint specification
├── frontend/
│   ├── api/
│   │   └── upload-url.js     # Serverless endpoint for Pinata signed URLs
│   ├── src/
│   │   ├── chain.ts          # Core chain interface mapped to contract entrypoints
│   │   ├── lib/
│   │   │   ├── chain.js      # Router between real and mock chain implementations
│   │   │   ├── chain.real.js # Taquito write calls + TzKT reads
│   │   │   ├── chain.mock.js # Deterministic in-memory blockchain simulation
│   │   │   ├── tezos.js      # BeaconWallet and TezosToolkit setup
│   │   │   ├── ipfs.js       # IPFS upload and dual-gateway fetch
│   │   │   ├── hash.js       # SHA-256 hashing in browser
│   │   │   ├── errors.js     # Plain-sentence contract error mapping
│   │   │   └── verify.js     # Cryptographic verification engine
│   │   ├── context/
│   │   │   └── WalletContext.jsx # Shared live wallet state & account switching
│   │   ├── components/       # Shell, Receipt, FingerprintDisplay, StatusBadge, Toast
│   │   └── pages/            # Inventory, ItemDetail, Register, Checkout, Returns, Verify
│   └── tests/
│       └── lib.test.js       # Cryptographic stability and contract state machine tests
├── scripts/
│   └── check-chain.mjs       # Read-only schema and on-chain storage audit against TzKT
└── DESIGN.md                 # Design system tokens and specifications
```

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- Temple Wallet browser extension (connected to Tezos Shadownet)

### Installation & Local Run

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

- To run in **Mock mode** (offline sandbox with instant transactions and account switcher): set `VITE_MOCK=1` in `frontend/.env.local`.
- To run on **Live Tezos Shadownet**: set `VITE_MOCK=0` in `frontend/.env.local`.

---

## Running Verification & Tests

### Unit Tests
Tests cryptographic hash stability, 1-bit tamper detection, error code extraction, deposit conservation, and contract state transitions:

```bash
cd frontend
node --test tests/lib.test.js
```

### On-Chain Contract Audit
Reads live contract storage and validates entrypoint parameter schemas directly from the Tezos Shadownet indexer:

```bash
node scripts/check-chain.mjs
```

### Production Build
```bash
cd frontend
npm run build
```

---

## License
MIT
