// High-level API used by UI screens. Wraps chain.js + tzkt.js.
// Reads VITE_CONTRACT_ADDRESS (or VITE_CONTRACT as fallback).
import * as chain from './chain.js';
import { getAdmin as tzktGetAdmin, listEquipment as tzktListEquipment, getEquipment as tzktGetEquipment, listLoans as tzktListLoans, listHistory } from './tzkt.js';
import { friendlyError } from './errors.js';

export const IS_MOCK = chain.IS_MOCK;

export async function getAdmin() {
  if (IS_MOCK) return chain.MOCK_ACCOUNTS?.Admin || 'tz1MockAdmin';
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
  return loans.find(l => l.id === Number(id)) || null;
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

export const approveCheckout = (loanId, hash, onState) =>
  wrap(() => chain.approveCheckout(loanId, hash, onState));

export const rejectCheckout = (loanId, onState) =>
  wrap(() => chain.rejectCheckout(loanId, onState));

export const cancelRequest = (loanId, onState) =>
  wrap(() => chain.cancelRequest(loanId, onState));

export const requestReturn = (loanId, cid, hash, onState) =>
  wrap(() => chain.requestReturn(loanId, cid, hash, onState));

// Demo: zero penalty always
export const approveReturn = (loanId, penaltyMutez = 0, hash, onState) =>
  wrap(() => chain.approveReturn(loanId, hash, penaltyMutez, onState));

export { listHistory };
