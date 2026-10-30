// Wallet (Temple via Beacon/octez.connect) + Taquito toolkit.
// Tezos docs say: use ONE BeaconWallet instance and ONE TezosToolkit instance for the whole app.
import { TezosToolkit } from '@taquito/taquito';
import { BeaconWallet } from '@taquito/beacon-wallet';
// Current Tezos docs import NetworkType from '@tezos-x/octez.connect-types'.
// If npm cannot find that package, install '@airgap/beacon-types' and change this one line.
import { NetworkType } from '@tezos-x/octez.connect-types';

const RPC = import.meta.env.VITE_RPC_URL || 'https://rpc.shadownet.teztnets.com';
export const Tezos = new TezosToolkit(RPC);

let wallet = null; // single instance, created on first connect

export async function connect() {
  if (!wallet) {
    wallet = new BeaconWallet({ name: 'OpavoLabs', network: { type: NetworkType.SHADOWNET } });
    // Workaround from the Tezos docs: await Beacon's IndexedDB init (race condition in @taquito/beacon-wallet).
    await wallet.client.beaconIDB.initDB().catch(() => {});
  }
  await wallet.requestPermissions();
  Tezos.setWalletProvider(wallet);
  return wallet.getPKH();
}

export async function disconnect() {
  await wallet?.client.clearActiveAccount();
}

export const getBalanceMutez = async (addr) => (await Tezos.tz.getBalance(addr)).toNumber();
