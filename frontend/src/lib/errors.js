// Turns contract / wallet / network errors into friendly text. One place only.
export const ERROR_TEXT = {
  NOT_ADMIN: 'Only the lab admin wallet can do this.',
  NO_TEZ_EXPECTED: 'This action must not send any tez.',
  EMPTY_NAME: 'Please enter a name for the equipment.',
  ADMIN_CANNOT_BORROW: 'The admin wallet cannot borrow equipment. Use a student wallet.',
  NO_SUCH_EQUIPMENT: 'That equipment does not exist.',
  NOT_AVAILABLE: 'This item is already reserved or checked out.',
  WRONG_DEPOSIT: 'The deposit must equal exactly the item deposit.',
  BAD_HASH: 'The photo fingerprint is invalid (must be 32 bytes).',
  EMPTY_CID: 'The photo upload did not return an address. Try again.',
  NO_SUCH_LOAN: 'That loan does not exist.',
  BAD_LOAN_STATE: 'This loan is not in the right state for that action.',
  HASH_MISMATCH: 'The photo you approved is not the one that was submitted.',
  NOT_BORROWER: 'Only the student who made this loan can do this.',
  PENALTY_TOO_HIGH: 'The penalty cannot be more than the deposit.',
  INSUFFICIENT_BALANCE: 'Not enough tez in this account. Use the faucet to top up.',
};

const CODE_RE = new RegExp(Object.keys(ERROR_TEXT).join('|'));

export function errorCode(err) {
  const m = String(err?.message ?? err ?? '').match(CODE_RE);
  return m ? m[0] : null;
}

export function friendlyError(err) {
  const msg = String(err?.message ?? err ?? '');
  const code = errorCode(err);
  if (code) return ERROR_TEXT[code];
  if (/abort|reject|denied|declin|cancel/i.test(msg)) return 'You cancelled in your wallet.';
  if (/balance_too_low|not enough|insufficient|empty_implicit/i.test(msg)) return ERROR_TEXT.INSUFFICIENT_BALANCE;
  if (/timeout|timed out/i.test(msg)) return 'That took too long. Please retry.';
  if (/network|failed to fetch/i.test(msg)) return 'Network problem. Check your connection and retry.';
  return 'Something went wrong: ' + msg.slice(0, 160);
}
