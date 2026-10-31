import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, CheckCircle } from 'lucide-react';
import { useWallet } from '../hooks/useWallet.js';
import { compressImage } from '../lib/image.js';
import { sha256Hex } from '../lib/hash.js';
import { uploadToIpfs } from '../lib/ipfs.js';
import { Fingerprint } from '../components/FingerprintDisplay.jsx';
import Receipt from '../components/Receipt.jsx';
import { toastOp, Toaster } from '../components/Toast.jsx';
import * as api from '../lib/chain-api.js';

export default function ReturnPage() {
  const { loanId } = useParams();
  const nav = useNavigate();
  const { address } = useWallet();
  const [loan, setLoan] = useState(null);
  const [blob, setBlob] = useState(null);
  const [hash, setHash] = useState('');
  const [cid, setCid] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getLoan(loanId).then(setLoan).catch((e) => setError(e.message));
  }, [loanId]);

  const onFileChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError('');
    try {
      const compressed = await compressImage(f);
      const h = await sha256Hex(compressed);
      setBlob(compressed);
      setHash(h);
      setPreviewUrl(URL.createObjectURL(compressed));
    } catch (err) {
      setError('Could not process image: ' + err.message);
    }
  };

  const upload = async () => {
    if (!blob) return;
    setUploading(true);
    setError('');
    try {
      const c = await uploadToIpfs(blob);
      setCid(c);
    } catch (err) {
      setError('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!cid || !hash) return;
    setBusy(true);
    setError('');
    const t = toastOp('Submit return');
    try {
      const result = await api.requestReturn(Number(loanId), cid, hash, (state, opHash) => {
        if (state === 'waiting') t.signing();
        if (state === 'confirming') t.confirming(opHash);
        if (state === 'slow') t.slow(opHash);
        if (state === 'done') t.done('Return requested on-chain!');
      });
      setReceipt(result?.opHash);
    } catch (err) {
      console.error('Request return error:', err);
      const msg = err?.message || String(err);
      setError(msg);
      t.error(msg);
    } finally {
      setBusy(false);
    }
  };

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
          Submit return — loan #{loanId}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Take a photo of the equipment you are returning to create an immutable on-chain record.
        </p>
      </div>

      {receipt ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-3">
          <div className="flex items-center gap-2 text-green-700 font-semibold text-base">
            <CheckCircle size={20} /> Return requested!
          </div>
          <p className="text-sm text-gray-700">
            Signed by student. Admin must approve the return.
          </p>
          <Receipt opHash={receipt} label="Student return transaction:" />
          <button
            type="button"
            onClick={() => nav('/')}
            className="mt-3 text-xs font-semibold text-blue-600 hover:underline block"
          >
            ← Back to equipment list
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 transition-colors bg-gray-50/50">
            <Camera size={26} className="text-gray-400 mb-2" />
            <span className="text-sm text-gray-600 font-medium">Capture return photo</span>
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
            <img
              src={previewUrl}
              alt="Return condition preview"
              className="h-44 object-contain w-full rounded-lg border border-gray-200 bg-gray-50"
            />
          )}

          {hash && <Fingerprint label="Photo fingerprint (SHA-256)" value={hash} />}
          {cid && <Fingerprint label="IPFS CID" value={cid} />}

          {error && (
            <div className="text-red-700 bg-red-50 p-3 rounded-md text-sm border border-red-200">
              {error}
            </div>
          )}

          {blob && !cid && (
            <button
              onClick={upload}
              disabled={uploading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-md text-sm transition-colors"
            >
              {uploading ? 'Uploading to IPFS...' : 'Upload photo to IPFS'}
            </button>
          )}

          {cid && (
            <button
              onClick={submit}
              disabled={busy}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-md text-sm transition-colors"
            >
              {busy ? 'Waiting for Temple...' : 'Sign and request return'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
