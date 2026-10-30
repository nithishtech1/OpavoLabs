# OpavoLabs: Interface Specification

This file defines the exact names and data shapes shared by the smart contract, the frontend and the integration code. Treat every name below as fixed. Do not rename, add or remove parameters, fields, statuses, error strings or functions. If something here looks wrong or insufficient, say so instead of changing it.

---

## 1. Smart contract (SmartPy)

Use current SmartPy syntax: `@sp.module`, `@sp.entrypoint`, package `smartpy-tezos` 0.24 or newer. Not the legacy `sp.add_entry_point` style. Target network: Tezos Shadownet.

### 1.1 Storage

| Field | Type |
| --- | --- |
| `admin` | address (set when deployed) |
| `next_equipment_id` | nat (starts at 0) |
| `next_loan_id` | nat (starts at 0) |
| `equipment` | big_map from nat to the equipment record |
| `loans` | big_map from nat to the loan record |

Equipment record: `name` (string), `deposit` (mutez), `status` (string), `current_loan` (option nat).

Loan record: `equipment_id` (nat), `student` (address), `deposit` (mutez), `checkout_cid` (string), `checkout_hash` (bytes), `return_cid` (option string), `return_hash` (option bytes), `status` (string), `penalty` (mutez), `requested_at` (timestamp), `closed_at` (option timestamp).

Units: 1 tez = 1,000,000 mutez.

### 1.2 Status strings

- Equipment: `AVAILABLE`, `RESERVED`, `CHECKED_OUT`, `RETURN_PENDING`
- Loan: `CHECKOUT_PENDING`, `ACTIVE`, `RETURN_PENDING`, `CLOSED`, `CANCELLED`, `REJECTED`
- Terminal loan states, never modified again: `CLOSED`, `CANCELLED`, `REJECTED`

Define each string once as a constant.

State machine:
- Equipment: `AVAILABLE` to `RESERVED` (request), to `CHECKED_OUT` (admin approves), to `RETURN_PENDING` (student returns), to `AVAILABLE` (admin approves return). A rejected or cancelled checkout returns `RESERVED` to `AVAILABLE`.
- Loan: `CHECKOUT_PENDING` to `ACTIVE` to `RETURN_PENDING` to `CLOSED`. Also `CHECKOUT_PENDING` to `CANCELLED` (student) or `REJECTED` (admin).

### 1.3 Entrypoints

Parameter names are exact. The website sends them by name.

**1. `register_equipment(name: string, deposit: mutez)`**
- Caller: admin only (`NOT_ADMIN`). Name non-empty (`EMPTY_NAME`). Must send 0 tez (`NO_TEZ_EXPECTED`).
- Effect: create equipment at `next_equipment_id` with status `AVAILABLE` and no current loan. Increment the counter.

**2. `request_checkout(equipment_id: nat, photo_cid: string, photo_hash: bytes)`**
- Caller: anyone except the admin (`ADMIN_CANNOT_BORROW`).
- Checks: equipment exists (`NO_SUCH_EQUIPMENT`); status is `AVAILABLE` (`NOT_AVAILABLE`); amount sent equals the item's deposit exactly (`WRONG_DEPOSIT`); hash is exactly 32 bytes (`BAD_HASH`); CID non-empty (`EMPTY_CID`).
- Effect: create a loan at `next_loan_id` with status `CHECKOUT_PENDING`, `student` = sender, `deposit` = amount sent, `requested_at` = now. Set equipment to `RESERVED` with `current_loan` = this loan. Increment the counter.
- Money: the deposit stays in the contract. It is locked at request time, not at approval time.

**3. `approve_checkout(loan_id: nat, seen_hash: bytes)`**
- Caller: admin only. Loan exists (`NO_SUCH_LOAN`). Loan status is `CHECKOUT_PENDING` (`BAD_LOAN_STATE`). `seen_hash` equals the stored `checkout_hash` (`HASH_MISMATCH`).
- Effect: loan becomes `ACTIVE`, equipment becomes `CHECKED_OUT`.

**4. `request_return(loan_id: nat, photo_cid: string, photo_hash: bytes)`**
- Caller: that loan's student only (`NOT_BORROWER`). Loan status is `ACTIVE` (`BAD_LOAN_STATE`). Same CID and hash checks as `request_checkout`.
- Effect: store `return_cid` and `return_hash`. Loan and equipment become `RETURN_PENDING`.

**5. `approve_return(loan_id: nat, seen_hash: bytes, penalty: mutez)`**
- Caller: admin only. Loan status is `RETURN_PENDING`. `seen_hash` equals the stored `return_hash`. `penalty` is not above the loan's deposit (`PENALTY_TOO_HIGH`).
- Effect, in this order: first change state (loan becomes `CLOSED`, record `penalty` and `closed_at`; equipment becomes `AVAILABLE` and `current_loan` is cleared). Then send money: `penalty` to the admin (skip if 0) and `deposit - penalty` to the student (skip if 0).

**6. `reject_checkout(loan_id: nat)`** (optional)
- Caller: admin only. Loan status must be `CHECKOUT_PENDING`.
- Effect: loan becomes `REJECTED`, equipment becomes `AVAILABLE` with `current_loan` cleared. Full deposit sent back to the student.

**7. `cancel_request(loan_id: nat)`** (optional)
- Caller: that loan's student only (`NOT_BORROWER`). Loan status must be `CHECKOUT_PENDING`.
- Effect: loan becomes `CANCELLED`, equipment becomes `AVAILABLE`. Full deposit refunded to the student.

Not included: `reject_return`, `set_admin`.

### 1.4 Error strings (exact text)

`NOT_ADMIN`, `EMPTY_NAME`, `NO_TEZ_EXPECTED`, `ADMIN_CANNOT_BORROW`, `NO_SUCH_EQUIPMENT`, `NOT_AVAILABLE`, `WRONG_DEPOSIT`, `BAD_HASH`, `EMPTY_CID`, `NO_SUCH_LOAN`, `BAD_LOAN_STATE`, `HASH_MISMATCH`, `NOT_BORROWER`, `PENALTY_TOO_HIGH`

### 1.5 Safety rules

1. Only `AVAILABLE` equipment can be requested.
2. Only the admin registers, approves or rejects. Only a loan's own student returns or cancels.
3. A loan moves only along the arrows in 1.2. Terminal loans never change.
4. A deposit is never released twice. Each release moves the loan to a terminal state in the same transaction.
5. Money conservation: the contract's balance always equals the sum of deposits of loans that are not terminal.
6. A failed transaction changes nothing.

---

## 2. JavaScript chain interface (`chain.js`)

The frontend never talks to the blockchain directly. Every screen calls the functions below. Two implementations export identical names and shapes: `chain.mock.js` (in-memory fake) and the real Tezos version. The environment variable `VITE_MOCK=1` selects the mock.

### 2.1 Data shapes

- IDs are plain numbers (`3`, not `"3"`).
- Money is always mutez as a number (5 tez is `5000000`). Only the screens convert to tez for display.
- Hashes are 64-character lowercase hex strings, no `0x` prefix.
- Timestamps are ISO strings, or `null`.
- Addresses are strings starting with `tz1`, `tz2` or `tz3`.

```js
Equipment = {
  id: 0,
  name: 'LiDAR sensor',
  deposit: 5000000,
  status: 'AVAILABLE',         // equipment statuses from 1.2
  currentLoan: null            // loan id, or null
}

Loan = {
  id: 0,
  equipmentId: 0,
  student: 'tz1...',
  deposit: 5000000,
  checkoutCid: '...',
  checkoutHash: '64 hex chars',
  returnCid: null,             // string or null
  returnHash: null,            // string or null
  status: 'CHECKOUT_PENDING',  // loan statuses from 1.2
  penalty: 0,
  requestedAt: '2026-10-31T10:00:00Z',
  closedAt: null               // ISO string or null
}

HistoryItem = {
  opHash: 'o...',
  timestamp: '2026-10-31T10:00:00Z',
  sender: 'tz1...',
  entrypoint: 'request_checkout',   // raw entrypoint name
  params: {}                        // the parameters that were sent
}
```

### 2.2 Functions (all return Promises)

Reads:

| Function | Returns |
| --- | --- |
| `getAdmin()` | the admin address (string) |
| `listEquipment()` | `Equipment[]` |
| `getEquipment(id)` | `Equipment`, or `null` |
| `listLoans()` | `Loan[]` (all loans including finished ones) |
| `listHistory()` | `HistoryItem[]`, newest first |

Writes. Each returns `{ opHash }` on success and throws on failure:

| Function | Contract entrypoint |
| --- | --- |
| `registerEquipment(name, depositMutez)` | `register_equipment` |
| `requestCheckout(equipmentId, cid, hash, depositMutez)` | `request_checkout` (attaches the deposit as the amount sent) |
| `approveCheckout(loanId, hash)` | `approve_checkout` (`hash` is sent as `seen_hash`) |
| `requestReturn(loanId, cid, hash)` | `request_return` |
| `approveReturn(loanId, hash, penaltyMutez)` | `approve_return` (the screens pass `0`) |
| `rejectCheckout(loanId)` | `reject_checkout` |
| `cancelRequest(loanId)` | `cancel_request` |

Wallet and session:

| Function | Returns |
| --- | --- |
| `connect()` | the connected address (real: opens the Temple wallet; mock: the current mock account) |
| `disconnect()` | nothing |
| `getAddress()` | the connected address, or `null` |
| `isAdmin()` | `true` if the connected address equals `getAdmin()` |

Mock only: `setMockAccount(name)` where `name` is `'admin'`, `'studentA'` or `'studentB'`. The real version has no equivalent. The UI may show an account switcher only when `VITE_MOCK=1`.

### 2.3 Errors

- A failed write throws an `Error` whose `.code` is one of the contract error strings in 1.4 (for example `err.code === 'NOT_AVAILABLE'`).
- Two extra codes exist outside the contract: `USER_CANCELLED` (the wallet popup was closed) and `NETWORK_ERROR`.
- Screens show friendly text for each code and never show the raw code to the user.

### 2.4 Mock behaviour

The mock follows the same rules as the contract, including throwing the same error codes, so error screens can be tested before the real contract exists.

- Three accounts: Admin, StudentA, StudentB (fake `tz1...` strings).
- Seed data: LiDAR sensor, Drone, KUKA pendant, all `AVAILABLE`, deposit 5 tez.
- Same state machine and checks as sections 1.2 and 1.3. The deposit is locked on request and refunded on approve return, cancel or reject.
- Every write waits 1 to 2 seconds before resolving, so loading states appear.
- Every write appends a `HistoryItem`.

---

## 3. Helper modules

| File | Function | Returns |
| --- | --- | --- |
| `lib/image.js` | `compressImage(file)` | `Promise<Blob>` (JPEG, max side 1280 px) |
| `lib/hash.js` | `sha256Hex(blob)` | `Promise<string>` (64 hex chars) |
| `lib/ipfs.js` | `uploadToIpfs(blob)` | `Promise<string>` (the CID) |
| `lib/ipfs.js` | `photoUrl(cid)` | `string` (the gateway address of the photo) |
| `lib/verify.js` | `verifyPhoto({ loanId, which, file, simulate })` | `Promise<{ match, computed, onchain }>` |

`which` is `'checkout'` or `'return'`. `file` is optional (a locally dropped file to check). `simulate: true` flips one byte in memory to demonstrate a mismatch. `match` is a boolean. `computed` and `onchain` are the two hex hashes.

Submit sequence on a checkout or return screen: Compress, Hash, Upload, Wallet, Confirm. The hash is computed on the exact compressed file that is uploaded.
