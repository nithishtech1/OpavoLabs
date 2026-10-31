import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, ChevronRight, Plus, Wallet } from 'lucide-react';
import StatusBadge from '../components/StatusBadge.jsx';
import { useWallet } from '../hooks/useWallet.js';
import * as api from '../lib/chain-api.js';

function Skeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg" />)}
    </div>
  );
}

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { address, isAdmin, connect } = useWallet();
  const nav = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const data = await api.listEquipment();
        if (!cancelled) setItems(data);
      } catch (e) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    const t = setInterval(load, 10000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Lab equipment</h1>
          <p className="text-sm text-gray-500 mt-0.5">Tezos Shadownet — verifiable handover</p>
        </div>
        {address && isAdmin && (
          <button onClick={() => nav('/register')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-2 rounded-md transition-colors">
            <Plus size={15} /> Register item
          </button>
        )}
      </div>

      {loading && <Skeleton />}
      {error && <div className="text-red-600 bg-red-50 p-4 rounded-lg border border-red-200 text-sm">{error}</div>}
      {!loading && !error && items.length === 0 && (
        <div className="text-center py-16 text-gray-500 bg-white border border-gray-200 rounded-lg p-6">
          <Package size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-800">No equipment registered yet</p>
          {address && isAdmin && (
            <p className="text-sm mt-1">Register the first item using the button above.</p>
          )}
          {!address && (
            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-3">Admin can register equipment after connecting wallet.</p>
              <button
                onClick={connect}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors"
              >
                <Wallet size={14} /> Connect wallet
              </button>
            </div>
          )}
        </div>
      )}
      {!loading && items.length > 0 && (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 bg-white">
          {items.map(item => (
            <button key={item.id} onClick={() => nav(`/item/${item.id}`)}
              className="w-full flex items-center gap-4 px-4 py-4 hover:bg-gray-50 text-left transition-colors group">
              <Package size={18} className="text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{item.name}</p>
                <p className="text-sm text-gray-500">{(item.depositMutez / 1e6).toFixed(2)} tez deposit</p>
              </div>
              <StatusBadge status={item.status} />
              <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
