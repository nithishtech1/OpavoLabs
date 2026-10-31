import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import StatusBadge from '../components/StatusBadge.jsx';
import Receipt from '../components/Receipt.jsx';
import { useWallet } from '../hooks/useWallet.js';
import * as api from '../lib/chain-api.js';

const EXPLORER = import.meta.env.VITE_EXPLORER_BASE || 'https://shadownet.tzkt.io';

export default function ItemDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { address, isAdmin } = useWallet();
  const [item, setItem] = useState(null);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [eq, allLoans] = await Promise.all([api.getEquipment(id), api.listLoans()]);
      setItem(eq);
      setLoans(allLoans.filter(l => l.equipmentId === Number(id)));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);

  if (loading) return <div className="animate-pulse h-40 bg-gray-100 rounded-lg" />;
  if (error) return <div className="text-red-600 bg-red-50 p-4 rounded-lg border border-red-200 text-sm">{error}</div>;
  if (!item) return <div className="text-gray-500 p-4">Item not found.</div>;

  const activeLoan = loans.find(l => ['CHECKOUT_PENDING','ACTIVE','RETURN_PENDING'].includes(l.status));
  const canCheckout = address && !isAdmin && item.status === 'AVAILABLE';
  const canReturn = address && !isAdmin && activeLoan && activeLoan.student === address && activeLoan.status === 'ACTIVE';
  const canApproveCheckout = address && activeLoan && activeLoan.status === 'CHECKOUT_PENDING';
  const canApproveReturn = address && activeLoan && activeLoan.status === 'RETURN_PENDING';

  return (
    <div>
      <button onClick={() => nav('/')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors">
        <ArrowLeft size={15} /> All equipment
      </button>
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{item.name}</h1>
            <p className="text-sm text-gray-500 mt-1">Deposit: {(item.depositMutez / 1e6).toFixed(2)} tez (refundable)</p>
          </div>
          <StatusBadge status={item.status} />
        </div>
        {activeLoan && (
          <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-600">
            <p>Borrower: <span className="font-mono text-gray-800">{activeLoan.student}</span></p>
            {activeLoan.status === 'CHECKOUT_PENDING' && <p className="mt-1 text-yellow-700">Waiting for admin to approve the handover.</p>}
            {activeLoan.status === 'ACTIVE' && <p className="mt-1 text-blue-700">Item is currently checked out.</p>}
            {activeLoan.status === 'RETURN_PENDING' && <p className="mt-1 text-orange-700">Student has submitted a return request. Admin must approve.</p>}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {canCheckout && (
            <button onClick={() => nav(`/checkout/${id}`)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors">
              Request checkout
            </button>
          )}
          {canReturn && (
            <button onClick={() => nav(`/return/${activeLoan.id}`)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors">
              Submit return
            </button>
          )}
          {canApproveCheckout && (
            <button onClick={() => nav(`/admin-approve-checkout/${activeLoan.id}`)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors">
              Review checkout request
            </button>
          )}
          {canApproveReturn && (
            <button onClick={() => nav(`/admin-approve-return/${activeLoan.id}`)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors">
              Review return request
            </button>
          )}
        </div>
      </div>

      {/* Activity list */}
      {loans.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Activity</h2>
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 bg-white">
            {loans.map(loan => (
              <div key={loan.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Loan #{loan.id}</span>
                  <StatusBadge status={loan.status} />
                </div>
                <p className="text-gray-500 text-xs mt-1">{loan.student}</p>
                <p className="text-gray-400 text-xs">{new Date(loan.requestedAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
