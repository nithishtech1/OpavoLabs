import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256Hex } from '../src/lib/hash.js';
import { verifyPhoto, flipOneByte } from '../src/lib/verify.js';
import { friendlyError, errorCode } from '../src/lib/errors.js';
import * as chain from '../src/lib/chain.mock.js';

const H1 = 'ab'.repeat(32), H2 = 'cd'.repeat(32), HBAD = 'ef'.repeat(32);
const T = 1_000_000;
const as = (n) => chain.mockSetSender(n);
const rejects = (p, code) => assert.rejects(p, (e) => { assert.equal(e.message, code); return true; });

test('sha256 known vector ("abc")', async () => {
  assert.equal(await sha256Hex(new Blob(['abc'])), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('hash stable, and one flipped byte changes it', async () => {
  const b = new Blob([new Uint8Array(1000).map((_, i) => i % 251)]);
  assert.equal(await sha256Hex(b), await sha256Hex(b));
  assert.notEqual(await sha256Hex(b), await sha256Hex(await flipOneByte(b)));
});

test('verify: match, mismatch, simulated tamper, 0x prefix tolerated', async () => {
  const photo = new Blob(['pretend-jpeg-bytes']);
  const good = await sha256Hex(photo);
  const fetchBlob = async () => photo;
  assert.equal((await verifyPhoto({ cid: 'c', onchainHash: good, fetchBlob })).match, true);
  assert.equal((await verifyPhoto({ cid: 'c', onchainHash: '0x' + good.toUpperCase(), fetchBlob })).match, true);
  const edited = new Blob(['pretend-jpeg-bytez']);
  const r = await verifyPhoto({ cid: 'c', onchainHash: good, file: edited, fetchBlob });
  assert.equal(r.match, false); assert.notEqual(r.computed, r.onchain);
  const sim = await verifyPhoto({ cid: 'c', onchainHash: good, simulateTamper: true, fetchBlob });
  assert.equal(sim.match, false); assert.equal(sim.simulated, true);
});

test('errors: code extraction and friendly text', () => {
  assert.equal(errorCode(new Error('(permanent) proto.alpha.michelson_v1.script_rejected with "NOT_AVAILABLE"')), 'NOT_AVAILABLE');
  assert.match(friendlyError(new Error('NOT_AVAILABLE')), /already reserved/);
  assert.match(friendlyError(new Error('Aborted by user')), /cancelled in your wallet/);
});

test('mock: full round trip with penalty, balances and conservation', async () => {
  chain.mockReset(); chain.mockSeed();
  const A = chain.MOCK_ACCOUNTS.StudentA, AD = chain.MOCK_ACCOUNTS.Admin;
  const a0 = await chain.getBalanceMutez(A), ad0 = await chain.getBalanceMutez(AD);
  as('StudentA');
  await chain.requestCheckout(0, 'cid1', H1, 5 * T);
  assert.equal(await chain.getBalanceMutez(A), a0 - 5 * T);
  assert.ok(chain.mockInvariantOk());
  as('Admin'); await chain.approveCheckout(0, H1);
  assert.equal((await chain.getEquipment(0)).status, 'CHECKED_OUT');
  as('StudentA'); await chain.requestReturn(0, 'cid2', H2);
  as('Admin'); await chain.approveReturn(0, H2, 1 * T);
  assert.equal(await chain.getBalanceMutez(A), a0 - 1 * T);   // student got 4 back
  assert.equal(await chain.getBalanceMutez(AD), ad0 + 1 * T); // admin got penalty
  assert.equal((await chain.getEquipment(0)).status, 'AVAILABLE');
  assert.ok(chain.mockInvariantOk());
  assert.equal((await chain.listHistory())[0].entrypoint, 'approve_return');
});

test('mock: same rejected cases as the contract suite', async () => {
  chain.mockReset(); chain.mockSeed();
  as('StudentA');
  await rejects(chain.registerEquipment('x', T), 'NOT_ADMIN');
  await rejects(chain.requestCheckout(0, 'c', H1, 4 * T), 'WRONG_DEPOSIT');
  await rejects(chain.requestCheckout(0, 'c', H1, 0), 'WRONG_DEPOSIT');
  await rejects(chain.requestCheckout(0, 'c', 'ab'.repeat(31), 5 * T), 'BAD_HASH');
  await rejects(chain.requestCheckout(0, '', H1, 5 * T), 'EMPTY_CID');
  await rejects(chain.requestCheckout(99, 'c', H1, 5 * T), 'NO_SUCH_EQUIPMENT');
  as('Admin'); await rejects(chain.requestCheckout(0, 'c', H1, 5 * T), 'ADMIN_CANNOT_BORROW');
  as('StudentA'); await chain.requestCheckout(0, 'c', H1, 5 * T);
  as('StudentB'); await rejects(chain.requestCheckout(0, 'c', H1, 5 * T), 'NOT_AVAILABLE');   // RESERVED
  await rejects(chain.cancelRequest(0), 'NOT_BORROWER');
  await rejects(chain.approveCheckout(0, H1), 'NOT_ADMIN');
  as('StudentA'); await rejects(chain.requestReturn(0, 'r', H2), 'BAD_LOAN_STATE');            // before approval
  as('Admin');
  await rejects(chain.approveCheckout(0, HBAD), 'HASH_MISMATCH');
  await chain.approveCheckout(0, H1);
  await rejects(chain.approveCheckout(0, H1), 'BAD_LOAN_STATE');                                // twice
  await rejects(chain.approveCheckout(42, H1), 'NO_SUCH_LOAN');
  as('StudentB'); await rejects(chain.requestCheckout(0, 'c', H1, 5 * T), 'NOT_AVAILABLE');    // CHECKED_OUT
  await rejects(chain.requestReturn(0, 'r', H2), 'NOT_BORROWER');
  as('StudentA'); await chain.requestReturn(0, 'r', H2);
  as('Admin');
  await rejects(chain.approveReturn(0, H2, 6 * T), 'PENALTY_TOO_HIGH');
  await chain.approveReturn(0, H2, 2 * T);
  const a = await chain.getBalanceMutez(chain.MOCK_ACCOUNTS.StudentA);
  await rejects(chain.approveReturn(0, H2, 2 * T), 'BAD_LOAN_STATE');                           // exactly once
  assert.equal(await chain.getBalanceMutez(chain.MOCK_ACCOUNTS.StudentA), a);
  assert.ok(chain.mockInvariantOk());
});

test('mock: cancel, reject, reject_return all refund / restore correctly', async () => {
  chain.mockReset(); chain.mockSeed();
  const A = chain.MOCK_ACCOUNTS.StudentA; const a0 = await chain.getBalanceMutez(A);
  as('StudentA'); await chain.requestCheckout(1, 'c', H1, 3 * T); await chain.cancelRequest(0);
  assert.equal(await chain.getBalanceMutez(A), a0);
  assert.equal((await chain.getEquipment(1)).status, 'AVAILABLE');
  await chain.requestCheckout(1, 'c', H1, 3 * T);
  as('Admin'); await chain.rejectCheckout(1);
  assert.equal(await chain.getBalanceMutez(A), a0);
  as('StudentA'); await chain.requestCheckout(1, 'c', H1, 3 * T);
  as('Admin'); await chain.approveCheckout(2, H1);
  as('StudentA'); await chain.requestReturn(2, 'r', H2);
  as('Admin'); await chain.rejectReturn(2);
  assert.equal((await chain.getEquipment(1)).status, 'CHECKED_OUT');
  as('StudentA'); await chain.requestReturn(2, 'r2', H2);
  as('Admin'); await chain.approveReturn(2, H2, 0);
  assert.equal(await chain.getBalanceMutez(A), a0);
  assert.ok(chain.mockInvariantOk());
});
