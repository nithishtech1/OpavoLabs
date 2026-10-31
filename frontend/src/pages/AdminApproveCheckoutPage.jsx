import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { useWallet } from '../hooks/useWallet.js';
import { sha256Hex } from '../lib/hash.js';
import { photoUrl } from '../lib/ipfs.js';
import { VerifyVerdict, Fingerprint } from '../components/FingerprintDisplay.jsx';
import Receipt from '../components/Receipt.jsx';
import { toastOp, Toaster } from '../components/Toast.jsx';
import * as api from '../lib/chain-api.js';

export default function AdminApproveCheckoutPage() {
  const { loanId } = useParams();
  const nav = useNavigate();
  const { address } = useWallet();
  const [loan, setLoan] = useState(null);
  const [downloadedHash, setDownloadedHash] = useState('');
  const [imgLoaded, setImgLoaded] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.getLoan(loanId).then(async (l) => {
      setLoan(l);
      if (l?.checkoutCid) {
        try {
          const url = photoUrl(l.checkoutCid);
          const res = await fetch(url);
          const blob = await res.blob();
          const h = await sha256Hex(blob);
          setDownloadedHash(h);
        } catch {}
      }
    });
  }, [loanId]);

  const approve = async () => {
    setBusy(true); setError('');
    const t = toastOp('Approve handover');
    try {
      const result = await api.approveCheckout(Number(loanId), loan.checkoutHash, (state) => {
        if (state === 'waiting') t.signing();
        if (state === 'confirming') t.confirming();
        if (state === 'done') t.done('Handover approved');
      });
      setReceipt(result?.opHash);
      setDone(true);
    } catch (e) { setError(e.message); t.error(e.message); }
    finally { setBusy(false); }
  };

  const match = downloadedHash && loan?.checkoutHash &&
    downloadedHash.toLowerCase() === loan.checkoutHash.toLowerCase();

  if (!loan) return <div className="animate-pulse h-40 bg-gray-100 rounded-lg" />;

  return (
    <div>
      <Toaster position="top-right" />
      <button onClick={() => nav(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors">
        <ArrowLeft size={15} /> Back
      </button>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Review checkout request — loan #{loanId}</h1>

      {loan.checkoutCid && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Photo submitted by student</p>
          <img src={photoUrl(loan.checkoutCid)} alt="Checkout photo" onLoad={() => setImgLoaded(true)}
            className="h-56 object-contain rounded-lg border border-gray-200 w-full bg-gray-50" />
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 space-y-2">
        <Fingerprint label="Recorded fingerprint (SHA-256)" value={loan.checkoutHash} />
        {downloadedHash && <Fingerprint label="Retrieved fingerprint (SHA-256)" value={downloadedHash} />}
      </div>

      {downloadedHash && <VerifyVerdict localHash={downloadedHash} remoteHash={loan.checkoutHash} />}

      {error && <div className="text-red-600 bg-red-50 p-3 rounded-md text-sm border border-red-200 mt-4">{error}</div>}

      {done ? (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-800 font-medium">
            <CheckCircle size={18} /> Approved — item checked out, loan active.
          </div>
          <p className="text-sm text-gray-600 mt-1">Signed by admin.</p>
          <Receipt opHash={receipt} label="Your transaction:" />
        </div>
      ) : (
        <button onClick={approve} disabled={busy || !match}
          className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-md text-sm transition-colors">
          {busy ? 'Waiting for Temple...' : 'Approve handover'}
        </button>
      )}
      {downloadedHash && !match && !done && (
        <p className="text-center text-xs text-red-600 mt-2">Approve is disabled — fingerprints do not match.</p>
      )}
    </div>
  );
}
