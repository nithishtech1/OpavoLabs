// Real chain: Taquito for writes, TzKT for reads. Same exports as chain.mock.js.
// Parameter names MUST match contracts/INTERFACE.md exactly.
import { Tezos, connect, disconnect, getBalanceMutez as balance, getAddress as getTezosAddress } from './tezos.js';
import * as tzkt from './tzkt.js';

const ADDR = import.meta.env.VITE_CONTRACT_ADDRESS || import.meta.env.VITE_CONTRACT;

export async function connectWallet() {
  return await connect();
}

export async function disconnectWallet() {
  await disconnect();
}

export async function getAddress() {
  return await getTezosAddress();
}

export const getBalanceMutez = (addr) => balance(addr);

export const getAdmin = tzkt.getAdmin;
export const listEquipment = tzkt.listEquipment;
export const getEquipment = tzkt.getEquipment;
export const listLoans = tzkt.listLoans;
export const listHistory = tzkt.listHistory;

// Helper to sanitize hash: 64 hex characters, lowercase, no 0x prefix
function cleanHash(h) {
  if (!h) return '';
  return String(h).replace(/^0x/i, '').toLowerCase();
}

// Shared write path: wallet popup -> send -> confirm -> let TzKT catch up.
async function write(onState, build, sendOpts = {}) {
  const c = await Tezos.wallet.at(ADDR);
  onState?.('waiting');
  const op = await build(c).send(sendOpts);
  const hash = op.opHash;
  onState?.('sending', hash);
  onState?.('confirming', hash);

  let confirmed = false;
  const slowTimer = setTimeout(() => {
    if (!confirmed) {
      onState?.('slow', hash);
    }
  }, 60000);

  try {
    await op.confirmation(1);
    confirmed = true;
    clearTimeout(slowTimer);
    await tzkt.sleep(3000); // indexer lag
    onState?.('done', hash);
    return hash;
  } catch (err) {
    clearTimeout(slowTimer);
    throw err;
  }
}

export const registerEquipment = (name, depositMutez, onState) =>
  write(onState, (c) => c.methodsObject.register_equipment({ name: String(name).trim(), deposit: Number(depositMutez) }), { amount: 0 });

export const requestCheckout = (equipmentId, cid, hash, depositMutez, onState) =>
  write(onState,
    (c) => c.methodsObject.request_checkout({ equipment_id: Number(equipmentId), photo_cid: String(cid), photo_hash: cleanHash(hash) }),
    { amount: Number(depositMutez), mutez: true });

export const approveCheckout = (loanId, hash, onState) =>
  write(onState, (c) => c.methodsObject.approve_checkout({ loan_id: Number(loanId), seen_hash: cleanHash(hash) }));

// single-value params use .methods, not .methodsObject
export const rejectCheckout = (loanId, onState) => write(onState, (c) => c.methods.reject_checkout(Number(loanId)));
export const cancelRequest = (loanId, onState) => write(onState, (c) => c.methods.cancel_request(Number(loanId)));
export const rejectReturn = (loanId, onState) => write(onState, (c) => c.methods.reject_return(Number(loanId)));

export const requestReturn = (loanId, cid, hash, onState) =>
  write(onState, (c) => c.methodsObject.request_return({ loan_id: Number(loanId), photo_cid: String(cid), photo_hash: cleanHash(hash) }));

export const approveReturn = (loanId, hash, penaltyMutez, onState) =>
  write(onState, (c) => c.methodsObject.approve_return({ loan_id: Number(loanId), seen_hash: cleanHash(hash), penalty: Number(penaltyMutez || 0) }));
