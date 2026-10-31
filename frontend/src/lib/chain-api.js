// High-level API used by UI screens. Wraps chain.js + tzkt.js.
// Reads VITE_CONTRACT_ADDRESS (or VITE_CONTRACT as fallback).
import * as chain from './chain.js';
import { getAdmin as tzktGetAdmin, listEquipment as tzktListEquipment, getEquipment as tzktGetEquipment, listLoans as tzktListLoans, listHistory } from './tzkt.js';
import { friendlyError } from './errors.js';

export const IS_MOCK = chain.IS_MOCK;

export async function getAdmin() {
  if (IS_MOCK) return chain.MOCK_ACCOUNTS?.Admin || 'tz1MockAdminxxxxxxxxxxxxxxxxxxxxxxxx';
  return tzktGetAdmin();
}

export async function listEquipment() {
  return chain.listEquipment();
}

export async function getEquipment(id) {
  return chain.getEquipment(Number(id));
}

export async function getLoan(id) {
  const loans = await chain.listLoans();
  return loans.find(l => Number(l.id) === Number(id)) || null;
}

export async function listLoans() {
  return chain.listLoans();
}

export async function getHistory(limit = 50) {
  if (IS_MOCK) return chain.listHistory();
  return listHistory(limit);
}

export async function connectWallet() {
  return chain.connectWallet();
}
export async function disconnectWallet() {
  return chain.disconnectWallet();
}
export async function getAddress() {
  return chain.getAddress();
}
export async function getBalanceMutez(addr) {
  return chain.getBalanceMutez(addr);
}

// Writes - each returns { opHash } or throws a friendly error string
async function wrap(fn) {
  try {
    const result = await fn();
    if (typeof result === 'string') return { opHash: result };
    return { opHash: result?.opHash || result || 'mock-op' };
  } catch (e) {
    throw new Error(friendlyError(e));
  }
}

export const registerEquipment = (name, depositMutez, onState) =>
  wrap(() => chain.registerEquipment(name, depositMutez, onState));

export const requestCheckout = (equipmentId, cid, hash, depositMutez, onState) =>
  wrap(() => chain.requestCheckout(equipmentId, cid, hash, depositMutez, onState));

export async function approveCheckout(loanId, hash, onState) {
  let seenHash = hash;
  let cb = onState;
  if (typeof hash === 'function') {
    cb = hash;
    seenHash = null;
  }
  if (!seenHash) {
    const loan = await getLoan(loanId);
    seenHash = loan?.checkoutHash;
  }
  return wrap(() => chain.approveCheckout(Number(loanId), seenHash, cb));
}

export const rejectCheckout = (loanId, onState) =>
  wrap(() => chain.rejectCheckout(Number(loanId), onState));

export const cancelRequest = (loanId, onState) =>
  wrap(() => chain.cancelRequest(Number(loanId), onState));

export const requestReturn = (loanId, cid, hash, onState) =>
  wrap(() => chain.requestReturn(Number(loanId), cid, hash, onState));

// Demo: zero penalty always; flexible parameter order
export async function approveReturn(loanId, arg2, arg3, arg4) {
  let hash, penaltyMutez = 0, onState;
  if (typeof arg2 === 'string' && /^[0-9a-fA-F]{64}$/.test(arg2.replace(/^0x/, ''))) {
    hash = arg2;
    penaltyMutez = typeof arg3 === 'number' ? arg3 : 0;
    onState = typeof arg4 === 'function' ? arg4 : (typeof arg3 === 'function' ? arg3 : undefined);
  } else if (typeof arg2 === 'number') {
    penaltyMutez = arg2;
    if (typeof arg3 === 'string') hash = arg3;
    onState = typeof arg4 === 'function' ? arg4 : (typeof arg3 === 'function' ? arg3 : undefined);
  } else if (typeof arg2 === 'function') {
    onState = arg2;
  }
  if (!hash) {
    const loan = await getLoan(loanId);
    hash = loan?.returnHash;
  }
  return wrap(() => chain.approveReturn(Number(loanId), hash, penaltyMutez, onState));
}

export { listHistory };
