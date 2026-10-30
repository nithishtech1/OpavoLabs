// The ONLY file the UI imports for blockchain calls. VITE_MOCK=1 -> fake chain, else real.
// Static imports (no top-level await) so the production build works on any Vite target.
import * as mock from './chain.mock.js';
import * as real from './chain.real.js';

export const IS_MOCK = import.meta.env.VITE_MOCK === '1';
const impl = IS_MOCK ? mock : real;

export const connectWallet = (...a) => impl.connectWallet(...a);
export const disconnectWallet = (...a) => impl.disconnectWallet(...a);
export const getAddress = (...a) => impl.getAddress(...a);
export const getBalanceMutez = (...a) => impl.getBalanceMutez(...a);
export const getAdmin = (...a) => impl.getAdmin(...a);
export const listEquipment = (...a) => impl.listEquipment(...a);
export const getEquipment = (...a) => impl.getEquipment(...a);
export const listLoans = (...a) => impl.listLoans(...a);
export const listHistory = (...a) => impl.listHistory(...a);
export const registerEquipment = (...a) => impl.registerEquipment(...a);
export const requestCheckout = (...a) => impl.requestCheckout(...a);
export const approveCheckout = (...a) => impl.approveCheckout(...a);
export const rejectCheckout = (...a) => impl.rejectCheckout(...a);
export const cancelRequest = (...a) => impl.cancelRequest(...a);
export const requestReturn = (...a) => impl.requestReturn(...a);
export const approveReturn = (...a) => impl.approveReturn(...a);
export const rejectReturn = (...a) => impl.rejectReturn(...a);

// Mock-only helpers (account switcher for the offline sandbox).
export const mockSetSender = mock.mockSetSender;
export const mockSeed = mock.mockSeed;
export const MOCK_ACCOUNTS = mock.MOCK_ACCOUNTS;
