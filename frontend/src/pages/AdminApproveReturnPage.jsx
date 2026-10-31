import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { sha256Hex } from '../lib/hash.js';
import { photoUrl, fetchPhotoBlob } from '../lib/ipfs.js';
import { Fingerprint } from '../components/FingerprintDisplay.jsx';
import Receipt from '../components/Receipt.jsx';
import { toastOp, Toaster } from '../components/Toast.jsx';
import * as api from '../lib/chain-api.js';

export default function AdminApproveReturnPage() {
  const { loanId } = useParams();
  const nav = useNavigate();
  const [loan, setLoan] = useState(null);
  const [item, setItem] = useState(null);
  const [downloadedHash, setDownloadedHash] = useState('');
  const [fetchingPhoto, setFetchingPhoto] = useState(true);
  const [receipt, setReceipt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const l = await api.getLoan(loanId);
        if (cancelled) return;
        setLoan(l);
        if (l?.equipmentId != null) {
          api.getEquipment(l.equipmentId).then((eq) => {
            if (!cancelled) setItem(eq);
          }).catch(() => {});
        }
        if (l?.returnCid) {
          setFetchingPhoto(true);
          try {
            const blob = await fetchPhotoBlob(l.returnCid);
            const h = await sha256Hex(blob);
            if (!cancelled) setDownloadedHash(h);
          } catch (err) {
            console.error('IPFS return fetch error:', err);
            if (!cancelled) setError(err.message);
          } finally {
            if (!cancelled) setFetchingPhoto(false);
          }
        } else {
          setFetchingPhoto(false);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [loanId]);

  const approve = async () => {
    setBusy(true);
    setError('');
    const t = toastOp('Approve return');
    try {
      // Demo uses zero penalty: approveReturn is called with penaltyMutez = 0
      const result = await api.approveReturn(Number(loanId), 0, loan.returnHash, (state, opHash) => {
        if (state === 'waiting') t.signing();
        if (state === 'confirming') t.confirming(opHash);
        if (state === 'slow') t.slow(opHash);
        if (state === 'done') t.done('Return approved and deposit refunded!');
      });
      setReceipt(result?.opHash);
      setDone(true);
    } catch (e) {
      console.error('Approve return error:', e);
      const msg = e?.message || String(e);
      setError(msg);
      t.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const match = Boolean(
    downloadedHash &&
    loan?.returnHash &&
    downloadedHash.toLowerCase() === loan.returnHash.toLowerCase()
  );

  const mismatch = Boolean(
    downloadedHash &&
    loan?.returnHash &&
    downloadedHash.toLowerCase() !== loan.returnHash.toLowerCase()
  );

  if (!loan) {
    return (
      <div className="py-12 text-center text-gray-500">
        <RefreshCw size={24} className="animate-spin mx-auto mb-2 opacity-50" />
        <p>Loading loan record #{loanId}...</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <Toaster position="top-right" />
      <button
        onClick={() => nav(-1)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft size={15} /> Back
      </button>

      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Review return request — loan #{loanId}
        </h1>
        {item && <p className="text-sm text-gray-500 mt-0.5">Item: {item.name}</p>}
      </div>

      {loan.returnCid && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">Photo submitted by student upon return</p>
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50 h-56 flex items-center justify-center">
            {fetchingPhoto ? (
              <div className="text-gray-400 flex items-center gap-2 text-xs">
                <RefreshCw size={14} className="animate-spin" /> Fetching return photo from IPFS...
              </div>
            ) : (
              <img
                src={photoUrl(loan.returnCid)}
                alt="Return photo"
                className="h-full w-full object-contain"
              />
            )}
          </div>
        </div>
      )}

      {loan.checkoutCid && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">Original checkout photo (condition at handover)</p>
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50 h-44 flex items-center justify-center">
            <img
              src={photoUrl(loan.checkoutCid)}
              alt="Checkout condition"
              className="h-full w-full object-contain"
            />
          </div>
        </div>
      )}

      {/* Fingerprints */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
        <Fingerprint label="Recorded on-chain (return SHA-256)" value={loan.returnHash} />
        {downloadedHash && (
          <Fingerprint label="Retrieved from IPFS (return SHA-256)" value={downloadedHash} />
        )}
      </div>

      {/* Verification Verdict */}
      {match && (
        <div className="p-4 rounded-lg border-2 bg-green-50 border-green-500 text-green-900 flex items-center gap-3">
          <CheckCircle size={24} className="text-green-600 shrink-0" />
          <div>
            <p className="font-bold text-sm">Photo verified: unchanged since handover</p>
            <p className="text-xs text-green-700 mt-0.5">
              The return photo matches the recorded fingerprint. Zero penalty: full deposit refund.
            </p>
          </div>
        </div>
      )}

      {mismatch && (
        <div className="p-4 rounded-lg border-2 bg-red-50 border-red-500 text-red-900 flex items-center gap-3">
          <XCircle size={24} className="text-red-600 shrink-0" />
          <div>
            <p className="font-bold text-sm">Photo does not match the record</p>
            <p className="text-xs text-red-700 mt-0.5">
              Fingerprint mismatch detected. Approval is disabled.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="text-red-700 bg-red-50 p-3 rounded-md text-sm border border-red-200">
          {error}
        </div>
      )}

      {done ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-green-800 font-semibold text-sm">
            <CheckCircle size={18} /> Available, loan closed
          </div>
          <p className="text-xs text-gray-600">
            Approved by admin. Refund transaction confirmed and deposit returned to student.
          </p>
          <Receipt opHash={receipt} label="Refund transaction:" />
          <button
            type="button"
            onClick={() => nav('/')}
            className="mt-3 text-xs font-semibold text-blue-600 hover:underline block"
          >
            ← Back to all equipment
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            onClick={approve}
            disabled={busy || mismatch || fetchingPhoto}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-md text-sm transition-colors"
          >
            {busy ? 'Waiting for wallet...' : 'Approve return & refund deposit (0 penalty)'}
          </button>
          <p className="text-center text-xs text-gray-400">
            Visible to all wallets. Non-admin wallets will show contract rejection.
          </p>
        </div>
      )}
    </div>
  );
}
