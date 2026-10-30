// In-memory fake blockchain. Same function names, return shapes and error codes as chain.real.js.
// It enforces the SAME rules as the contract, so UI work here transfers to the real chain.
export const MOCK_ACCOUNTS = {
  Admin: 'tz1MockAdminxxxxxxxxxxxxxxxxxxxxxxxx',
  StudentA: 'tz1MockStudentAxxxxxxxxxxxxxxxxxxxx',
  StudentB: 'tz1MockStudentBxxxxxxxxxxxxxxxxxxxx',
};
const ADMIN = MOCK_ACCOUNTS.Admin;
const TEZ = 1_000_000;

let S;
let sender;
let txCounter;
function fresh() {
  txCounter = 0;
  sender = null;
  S = {
    nextEq: 0, nextLoan: 0, equipment: {}, loans: {}, history: [], contractBalance: 0,
    balances: { [MOCK_ACCOUNTS.Admin]: 100 * TEZ, [MOCK_ACCOUNTS.StudentA]: 100 * TEZ, [MOCK_ACCOUNTS.StudentB]: 100 * TEZ },
  };
}
fresh();

const fail = (code) => { throw new Error(code); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const need = () => sender ?? fail('NOT_CONNECTED');
const bal = (a) => S.balances[a] ?? 0;

// ---- test/dev helpers (mock only) ----
export function mockReset() { fresh(); }
export function mockSetSender(nameOrAddr) { sender = MOCK_ACCOUNTS[nameOrAddr] ?? nameOrAddr; return sender; }
export function mockSeed() {
  const keep = sender; sender = ADMIN;
  S.nextEq = 0;
  for (const [n, d] of [['LiDAR sensor', 5], ['Drone', 3], ['KUKA pendant', 2]]) registerSync(n, d * TEZ);
  sender = keep;
}

// ---- wallet ----
export async function connectWallet() { if (!sender) sender = MOCK_ACCOUNTS.StudentA; return sender; }
export async function disconnectWallet() { sender = null; }
export async function getAddress() { return sender; }
export async function getBalanceMutez(addr = sender) { return bal(addr); }

// ---- reads ----
export async function getAdmin() { return ADMIN; }
export async function listEquipment() { return Object.values(S.equipment).map(clone); }
export async function getEquipment(id) { return clone(S.equipment[id] ?? null); }
export async function listLoans() { return Object.values(S.loans).map(clone); }
export async function listHistory() { return clone([...S.history].reverse()); }

// ---- writes ----
function log(entrypoint, params, amountMutez = 0) {
  S.history.push({ hash: 'oomock' + String(++txCounter).padStart(6, '0'), timestamp: new Date().toISOString(),
    sender, entrypoint, params: clone(params), amountMutez });
}
async function tx(onState, fn) {
  onState?.('waiting'); await sleep(5); onState?.('sending'); await sleep(5); onState?.('confirming');
  const r = fn(); await sleep(5); onState?.('done'); return r;
}
const isTerminal = (s) => ['CLOSED', 'CANCELLED', 'REJECTED'].includes(s);
const getLoan = (id) => S.loans[id] ?? fail('NO_SUCH_LOAN');
const isHash = (h) => typeof h === 'string' && /^[0-9a-fA-F]{64}$/.test(h);
function pay(to, amt) { if (amt > 0) { S.contractBalance -= amt; S.balances[to] = bal(to) + amt; } }

function registerSync(name, depositMutez) {
  if (sender !== ADMIN) fail('NOT_ADMIN');
  if (!name) fail('EMPTY_NAME');
  const id = S.nextEq++;
  S.equipment[id] = { id, name, depositMutez, status: 'AVAILABLE', currentLoan: null };
  log('register_equipment', { name, deposit: depositMutez });
}
export const registerEquipment = (name, depositMutez, onState) => tx(onState, () => { need(); registerSync(name, depositMutez); });

export const requestCheckout = (equipmentId, cid, hash, depositMutez, onState) => tx(onState, () => {
  need();
  if (sender === ADMIN) fail('ADMIN_CANNOT_BORROW');
  const eq = S.equipment[equipmentId] ?? fail('NO_SUCH_EQUIPMENT');
  if (eq.status !== 'AVAILABLE') fail('NOT_AVAILABLE');
  if (depositMutez !== eq.depositMutez) fail('WRONG_DEPOSIT');
  if (!isHash(hash)) fail('BAD_HASH');
  if (!cid) fail('EMPTY_CID');
  if (bal(sender) < depositMutez) fail('INSUFFICIENT_BALANCE');
  S.balances[sender] -= depositMutez; S.contractBalance += depositMutez;
  const id = S.nextLoan++;
  S.loans[id] = { id, equipmentId, student: sender, depositMutez, checkoutCid: cid, checkoutHash: hash.toLowerCase(),
    returnCid: null, returnHash: null, status: 'CHECKOUT_PENDING', penaltyMutez: 0, requestedAt: new Date().toISOString(), closedAt: null };
  eq.status = 'RESERVED'; eq.currentLoan = id;
  log('request_checkout', { equipment_id: equipmentId, photo_cid: cid, photo_hash: hash }, depositMutez);
});

export const approveCheckout = (loanId, hash, onState) => tx(onState, () => {
  need(); if (sender !== ADMIN) fail('NOT_ADMIN');
  const l = getLoan(loanId);
  if (l.status !== 'CHECKOUT_PENDING') fail('BAD_LOAN_STATE');
  if (String(hash).toLowerCase() !== l.checkoutHash) fail('HASH_MISMATCH');
  l.status = 'ACTIVE'; S.equipment[l.equipmentId].status = 'CHECKED_OUT';
  log('approve_checkout', { loan_id: loanId, seen_hash: hash });
});

function closeEarly(loanId) {
  const l = getLoan(loanId);
  if (l.status !== 'CHECKOUT_PENDING') fail('BAD_LOAN_STATE');
  return l;
}
export const rejectCheckout = (loanId, onState) => tx(onState, () => {
  need(); if (sender !== ADMIN) fail('NOT_ADMIN');
  const l = closeEarly(loanId);
  l.status = 'REJECTED'; l.closedAt = new Date().toISOString();
  const eq = S.equipment[l.equipmentId]; eq.status = 'AVAILABLE'; eq.currentLoan = null;
  pay(l.student, l.depositMutez); log('reject_checkout', { loan_id: loanId });
});
export const cancelRequest = (loanId, onState) => tx(onState, () => {
  need(); const l = getLoan(loanId);
  if (sender !== l.student) fail('NOT_BORROWER');
  closeEarly(loanId);
  l.status = 'CANCELLED'; l.closedAt = new Date().toISOString();
  const eq = S.equipment[l.equipmentId]; eq.status = 'AVAILABLE'; eq.currentLoan = null;
  pay(l.student, l.depositMutez); log('cancel_request', { loan_id: loanId });
});

export const requestReturn = (loanId, cid, hash, onState) => tx(onState, () => {
  need(); const l = getLoan(loanId);
  if (sender !== l.student) fail('NOT_BORROWER');
  if (l.status !== 'ACTIVE') fail('BAD_LOAN_STATE');
  if (!isHash(hash)) fail('BAD_HASH');
  if (!cid) fail('EMPTY_CID');
  l.returnCid = cid; l.returnHash = hash.toLowerCase(); l.status = 'RETURN_PENDING';
  S.equipment[l.equipmentId].status = 'RETURN_PENDING';
  log('request_return', { loan_id: loanId, photo_cid: cid, photo_hash: hash });
});

export const approveReturn = (loanId, hash, penaltyMutez, onState) => tx(onState, () => {
  need(); if (sender !== ADMIN) fail('NOT_ADMIN');
  const l = getLoan(loanId);
  if (l.status !== 'RETURN_PENDING') fail('BAD_LOAN_STATE');
  if (String(hash).toLowerCase() !== l.returnHash) fail('HASH_MISMATCH');
  if (penaltyMutez > l.depositMutez) fail('PENALTY_TOO_HIGH');
  l.status = 'CLOSED'; l.penaltyMutez = penaltyMutez; l.closedAt = new Date().toISOString();   // state first
  const eq = S.equipment[l.equipmentId]; eq.status = 'AVAILABLE'; eq.currentLoan = null;
  pay(ADMIN, penaltyMutez); pay(l.student, l.depositMutez - penaltyMutez);
  log('approve_return', { loan_id: loanId, seen_hash: hash, penalty: penaltyMutez });
});

export const rejectReturn = (loanId, onState) => tx(onState, () => {
  need(); if (sender !== ADMIN) fail('NOT_ADMIN');
  const l = getLoan(loanId);
  if (l.status !== 'RETURN_PENDING') fail('BAD_LOAN_STATE');
  l.status = 'ACTIVE'; S.equipment[l.equipmentId].status = 'CHECKED_OUT';
  log('reject_return', { loan_id: loanId });
});

// money-conservation check used by tests (rule 5 in spec 4.4)
export function mockInvariantOk() {
  const live = Object.values(S.loans).filter((l) => !isTerminal(l.status)).reduce((s, l) => s + l.depositMutez, 0);
  return live === S.contractBalance;
}
