# OpavoLabs contract interface (FROZEN at end of Phase 1)

Any change needs all three people to agree and this file updated the same day.
Money is in mutez (1 tez = 1,000,000). Hashes are 32 bytes (Taquito: 64 hex chars, NO 0x prefix).

## Statuses (strings)
- Equipment: AVAILABLE, RESERVED, CHECKED_OUT, RETURN_PENDING
- Loan: CHECKOUT_PENDING, ACTIVE, RETURN_PENDING, CLOSED, CANCELLED, REJECTED (last 3 + CLOSED are terminal)

## Storage
admin, next_equipment_id, next_loan_id,
equipment: big_map nat -> {name, deposit, status, current_loan: option nat}
loans: big_map nat -> {equipment_id, student, deposit, checkout_cid, checkout_hash, return_cid?, return_hash?, status, penalty, requested_at, closed_at?}

## Entrypoints
| # | Entrypoint | Params (exact names) | Caller | Tez sent | Errors | Effect / money |
|---|---|---|---|---|---|---|
| 1 | register_equipment [P0] | name:string, deposit:mutez | admin | 0 | NOT_ADMIN, NO_TEZ_EXPECTED, EMPTY_NAME | new equipment AVAILABLE |
| 2 | request_checkout [P0] | equipment_id:nat, photo_cid:string, photo_hash:bytes | not admin | == deposit | ADMIN_CANNOT_BORROW, NO_SUCH_EQUIPMENT, NOT_AVAILABLE, WRONG_DEPOSIT, BAD_HASH, EMPTY_CID | loan CHECKOUT_PENDING, equipment RESERVED, deposit held |
| 3 | approve_checkout [P0] | loan_id:nat, seen_hash:bytes | admin | 0 | NOT_ADMIN, NO_SUCH_LOAN, BAD_LOAN_STATE, HASH_MISMATCH | loan ACTIVE, equipment CHECKED_OUT |
| 4 | reject_checkout [P0] | loan_id:nat (single value) | admin | 0 | NOT_ADMIN, NO_SUCH_LOAN, BAD_LOAN_STATE | loan REJECTED, equipment AVAILABLE, FULL refund |
| 5 | cancel_request [P0] | loan_id:nat (single value) | loan's student | 0 | NOT_BORROWER, NO_SUCH_LOAN, BAD_LOAN_STATE | loan CANCELLED, equipment AVAILABLE, FULL refund |
| 6 | request_return [P0] | loan_id:nat, photo_cid:string, photo_hash:bytes | loan's student | 0 | NOT_BORROWER, BAD_LOAN_STATE, BAD_HASH, EMPTY_CID | loan+equipment RETURN_PENDING |
| 7 | approve_return [P0] | loan_id:nat, seen_hash:bytes, penalty:mutez | admin | 0 | NOT_ADMIN, BAD_LOAN_STATE, HASH_MISMATCH, PENALTY_TOO_HIGH | state first (CLOSED, AVAILABLE), then penalty->admin, rest->student |
| 8 | reject_return [P1] | loan_id:nat (single value) | admin | 0 | NOT_ADMIN, BAD_LOAN_STATE | loan ACTIVE, equipment CHECKED_OUT |
| 9 | set_admin [P2] | new_admin:address | admin | 0 | NOT_ADMIN | not built |

## Taquito call style
- Record params: `c.methodsObject.request_checkout({equipment_id, photo_cid, photo_hash}).send({amount, mutez:true})`
- Single-value params (4, 5, 8): `c.methods.reject_checkout(loanId).send()`

## App-side shapes (what chain.js / chain.mock.js return, identical in both)
Equipment: {id, name, depositMutez, status, currentLoan|null}
Loan: {id, equipmentId, student, depositMutez, checkoutCid, checkoutHash, returnCid|null, returnHash|null, status, penaltyMutez, requestedAt, closedAt|null}
History row: {hash, timestamp, sender, entrypoint, params, amountMutez}
Extra chain functions (not contract): connectWallet(), disconnectWallet(), getAddress(), getBalanceMutez(addr).
Every write takes an optional last arg `onState(state)` with states: waiting | sending | confirming | done.
