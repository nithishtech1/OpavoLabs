import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, ShieldAlert } from 'lucide-react';
import { useWallet } from '../hooks/useWallet.js';
import { toastOp, Toaster } from '../components/Toast.jsx';
import Receipt from '../components/Receipt.jsx';
import * as api from '../lib/chain-api.js';

export default function RegisterPage() {
  const nav = useNavigate();
  const { address, admin, isAdmin, connect } = useWallet();
  const [name, setName] = useState('');
  const [depositTez, setDepositTez] = useState('1');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a name for the equipment.');
      return;
    }

    const numTez = Number(depositTez);
    if (!depositTez || isNaN(numTez) || numTez <= 0) {
      setError('Please enter a valid deposit amount greater than 0 tez.');
      return;
    }

    // Convert tez to mutez as an integer (1 tez = 1,000,000 mutez)
    const depositMutez = Math.round(numTez * 1_000_000);

    setBusy(true);
    const t = toastOp('Register item');
    try {
      const result = await api.registerEquipment(trimmedName, depositMutez, (state, hash) => {
        if (state === 'waiting') t.signing();
        if (state === 'confirming') t.confirming(hash);
        if (state === 'slow') t.slow(hash);
        if (state === 'done') t.done(`Item "${trimmedName}" registered!`);
      });
      setReceipt(result?.opHash);
      setName('');
      setDepositTez('1');
    } catch (err) {
      console.error('Register equipment error:', err);
      const msg = err?.message || String(err);
      setError(msg);
      t.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <Toaster position="top-right" />
      <button
        onClick={() => nav('/')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
      >
        <ArrowLeft size={15} /> All equipment
      </button>

      <h1 className="text-xl font-semibold text-gray-900 mb-2">Register equipment</h1>
      <p className="text-sm text-gray-500 mb-6">
        Register lab equipment on Tezos Shadownet with a refundable student deposit.
      </p>

      {!address && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-5 flex items-center justify-between">
          <div className="text-sm text-blue-900">
            <p className="font-medium">Wallet not connected</p>
            <p className="text-xs text-blue-700 mt-0.5">Connect your admin wallet to register equipment.</p>
          </div>
          <button
            onClick={connect}
            type="button"
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
          >
            <Wallet size={13} /> Connect wallet
          </button>
        </div>
      )}

      {address && !isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-5 flex items-start gap-3">
          <ShieldAlert size={18} className="text-amber-700 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-medium">Non-admin account connected</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Only the lab admin ({admin ? `${admin.slice(0, 8)}...${admin.slice(-6)}` : 'admin wallet'}) can register equipment. Submitting will test the contract rejection.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="eq-name">
            Equipment name
          </label>
          <input
            id="eq-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. LiDAR Sensor"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="eq-deposit">
            Refundable deposit (tez)
          </label>
          <input
            id="eq-deposit"
            type="number"
            min="0.01"
            step="0.01"
            value={depositTez}
            onChange={(e) => setDepositTez(e.target.value)}
            placeholder="1"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Held in escrow on the smart contract and refunded upon verified return.
          </p>
        </div>

        {error && (
          <div className="text-red-700 bg-red-50 p-3 rounded-md text-sm border border-red-200">
            {error}
          </div>
        )}

        {receipt && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3">
            <p className="text-green-800 text-sm font-medium">Equipment successfully registered!</p>
            <Receipt opHash={receipt} label="Transaction:" />
            <button
              type="button"
              onClick={() => { setReceipt(null); setName(''); setDepositTez('1'); }}
              className="mt-2 text-sm text-blue-600 hover:underline block"
            >
              Register another item
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-md transition-colors text-sm"
        >
          {busy ? 'Registering on-chain...' : 'Register equipment'}
        </button>
      </form>

      {/* Temporary debug line required by STEP 1 */}
      <div className="mt-6 text-center text-xs font-mono text-gray-400 p-2 bg-gray-100 rounded border border-gray-200 break-all">
        Connected: {address || 'null'} | Admin: {admin || 'null'} | isAdmin: {String(isAdmin)}
      </div>
    </div>
  );
}
