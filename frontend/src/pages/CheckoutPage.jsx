import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, CheckCircle, Clock } from 'lucide-react';
import { useWallet } from '../hooks/useWallet.js';
import { compressImage } from '../lib/image.js';
import { sha256Hex } from '../lib/hash.js';
import { uploadToIpfs, photoUrl } from '../lib/ipfs.js';
import { Fingerprint } from '../components/FingerprintDisplay.jsx';
import Receipt from '../components/Receipt.jsx';
import { toastOp, Toaster } from '../components/Toast.jsx';
import * as api from '../lib/chain-api.js';

const STEPS = ['Photo', 'Verify', 'Deposit', 'Sign', 'Done'];

export default function CheckoutPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { address } = useWallet();
  const [step, setStep] = useState(0);
  const [item, setItem] = useState(null);
  const [file, setFile] = useState(null);
  const [blob, setBlob] = useState(null);
  const [hash, setHash] = useState('');
  const [cid, setCid] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [loanId, setLoanId] = useState(null);
  const [loan, setLoan] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.getEquipment(id).then(setItem).catch(() => {}); }, [id]);

  // Poll for loan state after Done
  useEffect(() => {
    if (step !== 4 || !loanId) return;
    const poll = async () => {
      const l = await api.getLoan(loanId).catch(() => null);
      if (l) setLoan(l);
    };
    poll();
    const t = setInterval(poll, 10000);
    return () => clearInterval(t);
  }, [step, loanId]);

  const onFileChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError('');
    setBusy(true);
    try {
      const compressed = await compressImage(f);
      const h = await sha256Hex(compressed);
      const url = URL.createObjectURL(compressed);
      setBlob(compressed); setHash(h); setPreviewUrl(url);
    } catch (e) { setError('Could not process image: ' + e.message); }
    finally { setBusy(false); }
  };

  const upload = async () => {
    if (!blob) return;
    setUploading(true); setError('');
    try {
      const c = await uploadToIpfs(blob);
      setCid(c);
      setStep(2); // to Deposit
    } catch (e) { setError('Upload failed: ' + e.message); }
    finally { setUploading(false); }
  };

  const sign = async () => {
    if (!item || !cid || !hash) return;
    setBusy(true); setError('');
    const t = toastOp('Request checkout');
    try {
      const result = await api.requestCheckout(Number(id), cid, hash, item.depositMutez, (state) => {
        if (state === 'waiting') t.signing();
        if (state === 'confirming') t.confirming();
        if (state === 'done') t.done('Checkout requested');
      });
      setReceipt(result?.opHash);
      // find the new loan
      const allLoans = await api.listLoans();
      const mine = allLoans.filter(l => l.equipmentId === Number(id) && l.student === address).at(-1);
      if (mine) setLoanId(mine.id);
      setStep(4);
    } catch (e) { setError(e.message); t.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <Toaster position="top-right" />
      <button onClick={() => nav(`/item/${id}`)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors">
        <ArrowLeft size={15} /> Back
      </button>
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${i <= step ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
              {i < step ? <CheckCircle size={14} /> : i + 1}
            </div>
            <span className={`text-xs font-medium ${i === step ? 'text-gray-900' : 'text-gray-400'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className={`h-px w-6 ${i < step ? 'bg-blue-400' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {item && <p className="text-sm text-gray-600 mb-4">Checking out: <strong>{item.name}</strong> — {(item.depositMutez / 1e6).toFixed(2)} tez deposit</p>}

      {error && <div className="text-red-600 bg-red-50 p-3 rounded-md text-sm border border-red-200 mb-4">{error}</div>}

      {/* Step 0: Photo */}
      {step === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="font-medium text-gray-900">Take a photo of the equipment</h2>
          <p className="text-sm text-gray-500">This photo's fingerprint will be recorded on-chain to prove the condition at handover.</p>
          <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 transition-colors">
            <Camera size={24} className="text-gray-400 mb-2" />
            <span className="text-sm text-gray-500">Tap to take a photo or choose a file</span>
            <input type="file" accept="image/*" capture="environment" onChange={onFileChange} className="sr-only" />
          </label>
          {previewUrl && (
            <div>
              <img src={previewUrl} alt="Preview" className="h-48 object-contain rounded-lg border border-gray-200 w-full" />
              <button onClick={() => setStep(1)} disabled={busy}
                className="mt-3 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-md text-sm transition-colors">
                {busy ? 'Processing...' : 'Continue to verify'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 1: Verify */}
      {step === 1 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="font-medium text-gray-900">Verify the photo fingerprint</h2>
          {previewUrl && <img src={previewUrl} alt="Preview" className="h-48 object-contain rounded-lg border border-gray-200 w-full" />}
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-2">
            <Fingerprint label="Photo fingerprint (SHA-256)" value={hash} />
            {cid ? <Fingerprint label="IPFS CID" value={cid} /> : (
              <p className="text-xs text-gray-500">CID will appear after upload.</p>
            )}
          </div>
          {!cid && (
            <button onClick={upload} disabled={uploading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-md text-sm transition-colors">
              {uploading ? 'Uploading to IPFS...' : 'Upload to IPFS and continue'}
            </button>
          )}
          {cid && (
            <button onClick={() => setStep(2)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-md text-sm transition-colors">
              Continue to deposit
            </button>
          )}
        </div>
      )}

      {/* Step 2: Deposit */}
      {step === 2 && item && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="font-medium text-gray-900">Confirm deposit</h2>
          <p className="text-sm text-gray-600">A deposit of <strong>{(item.depositMutez / 1e6).toFixed(2)} tez</strong> will be held in the contract until you return the item. It is fully refundable.</p>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-sm space-y-1">
            <p className="text-gray-700">Item: <strong>{item.name}</strong></p>
            <Fingerprint label="Photo fingerprint (SHA-256)" value={hash} />
            <Fingerprint label="IPFS CID" value={cid} />
          </div>
          <button onClick={sign} disabled={busy}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-md text-sm transition-colors">
            {busy ? 'Waiting for Temple...' : 'Request checkout'}
          </button>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 4 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle size={20} />
            <h2 className="font-medium">Checkout requested</h2>
          </div>
          <p className="text-sm text-gray-600">Signed by student. Admin must approve the handover next.</p>
          <Receipt opHash={receipt} label="Your transaction:" />
          {loan?.status === 'ACTIVE' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-green-800 font-medium text-sm">Admin approved — item checked out.</p>
            </div>
          )}
          {(!loan || loan.status === 'CHECKOUT_PENDING') && (
            <div className="flex items-center gap-2 text-yellow-700 text-sm">
              <Clock size={15} className="animate-spin" />
              Waiting for admin approval...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
