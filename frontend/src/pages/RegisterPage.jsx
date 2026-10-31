import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useWallet } from '../hooks/useWallet.js';
import { toastOp, Toaster } from '../components/Toast.jsx';
import Receipt from '../components/Receipt.jsx';
import * as api from '../lib/chain-api.js';

export default function RegisterPage() {
  const nav = useNavigate();
  const { address, isAdmin } = useWallet();
  const [name, setName] = useState('');
  const [depositTez, setDepositTez] = useState('5');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    const depositMutez = Math.round(Number(depositTez) * 1e6);
    if (depositMutez <= 0) { setError('Deposit must be greater than zero.'); return; }
    setBusy(true); setError(null);
    const t = toastOp('Register item');
    try {
      const result = await api.registerEquipment(name.trim(), depositMutez, (state) => {
        if (state === 'waiting') t.signing();
        if (state === 'confirming') t.confirming();
        if (state === 'done') t.done(`Item "${name}" registered`);
      });
      setReceipt(result?.opHash);
    } catch (e) { setError(e.message); t.error(e.message); }
    finally { setBusy(false); }
  };

  if (!address || !isAdmin) {
    return <div className="text-gray-600 p-4">Only the admin can register equipment.</div>;
  }

  return (
    <div>
      <Toaster position="top-right" />
      <button onClick={() => nav('/')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors">
        <ArrowLeft size={15} /> All equipment
      </button>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Register new item</h1>
      <form onSubmit={submit} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Item name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. LiDAR sensor"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Deposit (tez)</label>
          <input type="number" min="0.01" step="0.01" value={depositTez} onChange={e => setDepositTez(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <p className="text-xs text-gray-400 mt-1">Refunded to the student when the item is returned.</p>
        </div>
        {error && <div className="text-red-600 bg-red-50 p-3 rounded-md text-sm border border-red-200">{error}</div>}
        {receipt && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3">
            <p className="text-green-800 text-sm font-medium">Item registered.</p>
            <Receipt opHash={receipt} label="Transaction:" />
            <button type="button" onClick={() => { setReceipt(null); setName(''); setDepositTez('5'); }}
              className="mt-2 text-sm text-blue-600 hover:underline">Register another</button>
          </div>
        )}
        {!receipt && (
          <button type="submit" disabled={busy}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-md transition-colors text-sm">
            {busy ? 'Registering...' : 'Register item'}
          </button>
        )}
      </form>
    </div>
  );
}
