import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, CheckCircle, Clock, Copy, Check } from 'lucide-react';
import { useWallet } from '../hooks/useWallet.js';
import { compressImage } from '../lib/image.js';
import { sha256Hex } from '../lib/hash.js';
import { uploadToIpfs } from '../lib/ipfs.js';
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
  const [copiedHash, setCopiedHash] = useState(false);

  useEffect(() => {
    api.getEquipment(id).then(setItem).catch((e) => setError(e.message));
  }, [id]);

  // Step 4: Poll every 10s for admin approval
  useEffect(() => {
    if (step !== 4 || !loanId) return;
    const poll = async () => {
      try {
        const l = await api.getLoan(loanId);
        if (l) setLoan(l);
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
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
      setBlob(compressed);
      setHash(h);
      setPreviewUrl(url);
    } catch (err) {
      setError('Could not process image: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const uploadAndVerify = async () => {
    if (!blob) return;
    setUploading(true);
    setError('');
    try {
      const c = await uploadToIpfs(blob);
      setCid(c);
      setStep(1); // Proceed to Verify step
    } catch (err) {
      setError('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const copyHashToClipboard = () => {
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const sign = async () => {
    if (!item || !cid || !hash) return;
    setBusy(true);
    setError('');
    const t = toastOp('Request checkout');
    try {
      const result = await api.requestCheckout(Number(id), cid, hash, item.depositMutez, (state, opHash) => {
        if (state === 'waiting') t.signing();
        if (state === 'confirming') t.confirming(opHash);
        if (state === 'slow') t.slow(opHash);
        if (state === 'done') t.done('Checkout request confirmed on-chain!');
      });
      setReceipt(result?.opHash);

      // Locate the newly created loan
      const allLoans = await api.listLoans();
      const mine = allLoans.filter((l) => l.equipmentId === Number(id) && l.student === address).at(-1);
      if (mine) setLoanId(mine.id);
      setStep(4); // Proceed to Done step
    } catch (err) {
      console.error('Checkout error:', err);
      const msg = err?.message || String(err);
      setError(msg);
      t.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <Toaster position="top-right" />
      <button
        onClick={() => nav(`/item/${id}`)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
      >
        <ArrowLeft size={15} /> Back
      </button>

      {/* Stepper Header */}
      <div className="flex items-center justify-between mb-6 border-b border-gray-200 pb-4">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1.5">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                i < step
                  ? 'bg-green-600 text-white'
                  : i === step
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {i < step ? <CheckCircle size={14} /> : i + 1}
            </div>
            <span
              className={`text-xs font-medium hidden sm:inline ${
                i === step ? 'text-gray-900 font-bold' : i < step ? 'text-green-700' : 'text-gray-400'
              }`}
            >
              {s}
            </span>
            {i < STEPS.length - 1 && <div className={`hidden sm:block h-px w-6 ${i < step ? 'bg-green-400' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {item && (
        <p className="text-sm text-gray-600 mb-4">
          Item: <strong className="text-gray-900">{item.name}</strong> • Refundable deposit:{' '}
          <strong className="text-blue-700">{(item.depositMutez / 1e6).toFixed(2)} tez</strong>
        </p>
      )}

      {error && (
        <div className="text-red-700 bg-red-50 p-3 rounded-md text-sm border border-red-200 mb-4">
          {error}
        </div>
      )}

      {/* STEP 0: Photo Capture */}
      {step === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Step 1: Take photo of item condition</h2>
          <p className="text-sm text-gray-500">
            A cryptographic SHA-256 fingerprint will be recorded on Tezos Shadownet to prove the exact condition at handover.
          </p>
          <label className="flex flex-col items-center justify-center h-44 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 transition-colors bg-gray-50/50">
            <Camera size={28} className="text-gray-400 mb-2" />
            <span className="text-sm text-gray-600 font-medium">Capture photo or choose file</span>
            <span className="text-xs text-gray-400 mt-0.5">Camera enabled on mobile</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFileChange}
              className="sr-only"
            />
          </label>
          {previewUrl && (
            <div className="space-y-3 pt-2">
              <img
                src={previewUrl}
                alt="Preview"
                className="h-48 object-contain rounded-lg border border-gray-200 w-full bg-gray-50"
              />
              <button
                type="button"
                onClick={uploadAndVerify}
                disabled={busy || uploading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-md text-sm transition-colors"
              >
                {uploading ? 'Uploading to IPFS...' : 'Upload to IPFS and verify fingerprint →'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 1: Verify Fingerprint & CID */}
      {step === 1 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Step 2: Verify photo fingerprint</h2>
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Preview"
              className="h-44 object-contain rounded-lg border border-gray-200 w-full bg-gray-50"
            />
          )}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
            <div>
              <span className="text-xs text-gray-500 block mb-0.5">SHA-256 Fingerprint:</span>
              <div className="flex items-center gap-2">
                <code className="font-mono text-xs text-gray-800 bg-white px-2 py-1 rounded border border-gray-200 flex-1 break-all">
                  {hash ? `${hash.slice(0, 10)}...${hash.slice(-8)}` : ''}
                </code>
                <button
                  type="button"
                  onClick={copyHashToClipboard}
                  className="p-1 text-gray-500 hover:text-gray-800 rounded border border-gray-200 bg-white"
                  title="Copy full hash"
                >
                  {copiedHash ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <div>
              <span className="text-xs text-gray-500 block mb-0.5">IPFS CID:</span>
              <code className="font-mono text-xs text-gray-800 bg-white px-2 py-1 rounded border border-gray-200 block break-all">
                {cid}
              </code>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-md text-sm transition-colors"
          >
            Confirm and proceed to deposit →
          </button>
        </div>
      )}

      {/* STEP 2: Deposit Summary */}
      {step === 2 && item && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Step 3: Deposit terms</h2>
          <p className="text-sm text-gray-600">
            A deposit of <strong className="text-blue-700">{(item.depositMutez / 1e6).toFixed(2)} tez</strong> will be transferred to the contract escrow. It will be 100% refunded when the item is returned.
          </p>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-sm space-y-1">
            <p className="text-gray-700">Item: <strong>{item.name}</strong></p>
            <p className="text-gray-700">Escrow amount: <strong>{(item.depositMutez / 1e6).toFixed(2)} tez</strong></p>
            <p className="text-gray-500 text-xs">Photo fingerprint: {hash.slice(0, 10)}...{hash.slice(-8)}</p>
          </div>
          <button
            type="button"
            onClick={() => setStep(3)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-md text-sm transition-colors"
          >
            Continue to sign in wallet →
          </button>
        </div>
      )}

      {/* STEP 3: Sign in Wallet */}
      {step === 3 && item && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Step 4: Sign request in Temple</h2>
          <p className="text-sm text-gray-600">
            Confirm the transaction in your Temple wallet. Your wallet will transfer the deposit of{' '}
            <strong>{(item.depositMutez / 1e6).toFixed(2)} tez</strong> to the contract and record your photo CID and fingerprint.
          </p>
          <button
            type="button"
            onClick={sign}
            disabled={busy}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-md text-sm transition-colors"
          >
            {busy ? 'Waiting for Temple signature...' : `Sign & send ${(item.depositMutez / 1e6).toFixed(2)} tez deposit`}
          </button>
        </div>
      )}

      {/* STEP 4: Done & Status Polling */}
      {step === 4 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle size={22} />
            <h2 className="font-semibold text-lg">Checkout requested</h2>
          </div>
          <p className="text-sm text-gray-700 font-medium">
            Signed by student. Admin must approve next.
          </p>
          <Receipt opHash={receipt} label="Student transaction:" />

          {loan?.status === 'ACTIVE' ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-semibold text-sm">
                Admin approved — Checked out, loan active.
              </p>
              <button
                type="button"
                onClick={() => nav(`/item/${id}`)}
                className="mt-3 text-xs font-semibold text-blue-600 hover:underline"
              >
                Return to item detail
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
              <Clock size={16} className="animate-spin text-yellow-700 shrink-0" />
              <span>Waiting for admin approval (polling every 10 s)...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
