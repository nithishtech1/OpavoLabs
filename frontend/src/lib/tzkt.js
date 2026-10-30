// TzKT reader. Footer must show "Powered by TzKT API" linking to tzkt.io.
// Shapes returned match INTERFACE.md "App-side shapes".
const API = import.meta.env.VITE_TZKT_API;
const ADDR = import.meta.env.VITE_CONTRACT;

async function get(path) {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error('TzKT ' + res.status + ' on ' + path);
  return res.json();
}

const nEquipment = (r) => ({
  id: Number(r.key), name: r.value.name, depositMutez: Number(r.value.deposit),
  status: r.value.status, currentLoan: r.value.current_loan == null ? null : Number(r.value.current_loan),
});
const nLoan = (r) => {
  const v = r.value;
  return {
    id: Number(r.key), equipmentId: Number(v.equipment_id), student: v.student, depositMutez: Number(v.deposit),
    checkoutCid: v.checkout_cid, checkoutHash: String(v.checkout_hash).toLowerCase(),
    returnCid: v.return_cid ?? null, returnHash: v.return_hash ? String(v.return_hash).toLowerCase() : null,
    status: v.status, penaltyMutez: Number(v.penalty), requestedAt: v.requested_at, closedAt: v.closed_at ?? null,
  };
};

export async function listEquipment() {
  const rows = await get(`/v1/contracts/${ADDR}/bigmaps/equipment/keys?active=true&limit=200`);
  return rows.map(nEquipment).sort((a, b) => a.id - b.id);
}
export async function getEquipment(id) {
  try { return nEquipment(await get(`/v1/contracts/${ADDR}/bigmaps/equipment/keys/${id}`)); } catch { return null; }
}
export async function listLoans() {
  const rows = await get(`/v1/contracts/${ADDR}/bigmaps/loans/keys?active=true&limit=200`);
  return rows.map(nLoan).sort((a, b) => a.id - b.id);
}
export async function getAdmin() { return (await get(`/v1/contracts/${ADDR}/storage`)).admin; }
export async function listHistory(limit = 50) {
  const rows = await get(`/v1/operations/transactions?target=${ADDR}&status=applied&sort.desc=id&limit=${limit}`);
  return rows.map((t) => ({
    hash: t.hash, timestamp: t.timestamp, sender: t.sender?.address,
    entrypoint: t.parameter?.entrypoint ?? '(transfer)', params: t.parameter?.value ?? null, amountMutez: Number(t.amount ?? 0),
  }));
}

export const explorerUrl = (opHash) => `${import.meta.env.VITE_EXPLORER_BASE ?? 'https://shadownet.tzkt.io'}/${opHash}`;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Indexer lag: after op.confirmation(1) wait ~3s, refetch, retry up to 3 times until `isFresh(data)`.
export async function refetchUntil(fetcher, isFresh = () => true, tries = 3, delayMs = 3000) {
  let data;
  for (let i = 0; i < tries; i++) {
    await sleep(delayMs);
    data = await fetcher();
    if (isFresh(data)) return data;
  }
  return data;
}

export const HISTORY_LABELS = {
  register_equipment: 'Equipment registered', request_checkout: 'Checkout requested',
  approve_checkout: 'Checkout approved', reject_checkout: 'Checkout rejected',
  cancel_request: 'Request cancelled', request_return: 'Return requested',
  approve_return: 'Return approved', reject_return: 'Return rejected',
};
