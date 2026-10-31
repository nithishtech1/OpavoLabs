// Wallet (Temple via Beacon/octez.connect) + Taquito toolkit.
// Tezos docs say: use ONE BeaconWallet instance and ONE TezosToolkit instance for the whole app.
import { TezosToolkit } from '@taquito/taquito';
import { BeaconWallet } from '@taquito/beacon-wallet';
import { NetworkType } from '@tezos-x/octez.connect-types';

const RPC = import.meta.env.VITE_RPC_URL || 'https://rpc.shadownet.teztnets.com';
export const Tezos = new TezosToolkit(RPC);

let wallet = null;

export function getWallet() {
  if (!wallet) {
    wallet = new BeaconWallet({
      name: 'OpavoLabs',
      network: { type: NetworkType.SHADOWNET }
    });
    Tezos.setWalletProvider(wallet);
  }
  return wallet;
}

export async function connect() {
  const w = getWallet();
  try {
    await w.client.beaconIDB.initDB().catch(() => {});
  } catch {}
  await w.requestPermissions();
  Tezos.setWalletProvider(w);
  return await w.getPKH();
}

export async function disconnect() {
  const w = getWallet();
  try {
    await w.client.clearActiveAccount();
  } catch {}
}

export async function getAddress() {
  const w = getWallet();
  try {
    await w.client.beaconIDB.initDB().catch(() => {});
    const activeAccount = await w.client.getActiveAccount().catch(() => null);
    if (activeAccount?.address) {
      Tezos.setWalletProvider(w);
      return activeAccount.address;
    }
    return null;
  } catch {
    return null;
  }
}

export const getBalanceMutez = async (addr) => {
  if (!addr) return 0;
  try {
    return (await Tezos.tz.getBalance(addr)).toNumber();
  } catch {
    return 0;
  }
};
