// PART A: src/chain.ts
// Exact exports mapped to the real contract entrypoints:
// getAdmin(), listEquipment(), getLoan(id), registerEquipment(...),
// requestCheckout(id, cid, hash, depositMutez), approveCheckout(id),
// requestReturn(id, cid, hash), approveReturn(id, penaltyMutez = 0).
// Each write waits for confirmation and returns { opHash }. Contract failures become plain sentences.

import * as chain from './lib/chain.js';
import { friendlyError } from './lib/errors.js';

export const IS_MOCK = chain.IS_MOCK;

export async function getAdmin() {
  try {
    return await chain.getAdmin();
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}

export async function listEquipment() {
  try {
    return await chain.listEquipment();
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}

export async function getLoan(id) {
  try {
    const loans = await chain.listLoans();
    return loans.find((l) => Number(l.id) === Number(id)) || null;
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}

async function wrapWrite(fn) {
  try {
    const res = await fn();
    const opHash = typeof res === 'string' ? res : (res?.opHash || 'op-success');
    return { opHash };
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}

export async function registerEquipment(name, depositMutez, onState) {
  return wrapWrite(() => chain.registerEquipment(name, depositMutez, onState));
}

export async function requestCheckout(id, cid, hash, depositMutez, onState) {
  return wrapWrite(() => chain.requestCheckout(Number(id), cid, hash, depositMutez, onState));
}

export async function approveCheckout(id, onState, seenHash) {
  let hash = seenHash;
  let cb = onState;
  if (typeof onState === 'string') {
    hash = onState;
    cb = seenHash;
  }
  if (!hash) {
    const loan = await getLoan(id);
    if (!loan) throw new Error('That loan does not exist.');
    hash = loan.checkoutHash;
  }
  return wrapWrite(() => chain.approveCheckout(Number(id), hash, cb));
}

export async function requestReturn(id, cid, hash, onState) {
  return wrapWrite(() => chain.requestReturn(Number(id), cid, hash, onState));
}

export async function approveReturn(id, penaltyMutez = 0, onState, seenHash) {
  let hash = seenHash;
  let cb = onState;
  let penalty = typeof penaltyMutez === 'number' ? penaltyMutez : 0;
  if (typeof penaltyMutez === 'string' && /^[0-9a-fA-F]{64}$/.test(penaltyMutez)) {
    hash = penaltyMutez;
    penalty = 0;
  }
  if (!hash) {
    const loan = await getLoan(id);
    if (!loan) throw new Error('That loan does not exist.');
    hash = loan.returnHash;
  }
  return wrapWrite(() => chain.approveReturn(Number(id), hash, penalty, cb));
}

// Additional exports
export const connectWallet = chain.connectWallet;
export const disconnectWallet = chain.disconnectWallet;
export const getAddress = chain.getAddress;
export const getBalanceMutez = chain.getBalanceMutez;
export const listLoans = chain.listLoans;
export const listHistory = chain.listHistory;
