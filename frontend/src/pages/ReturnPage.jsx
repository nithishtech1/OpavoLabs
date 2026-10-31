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
  const [loan, setLoan] = useState(null);
  const [blob, setBlob] = useState(null);
  const [hash, setHash] = useState('');
  const [cid, setCid] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api.getLoan(loanId).then(setLoan).catch(() => {}); }, [loanId]);

  const onFileChange = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const compressed = await compressImage(f);
      const h = await sha256Hex(compressed);
      setBlob(compressed); setHash(h);
      setPreviewUrl(URL.createObjectURL(compressed));
    } catch (e) { setError('Could not process image: ' + e.message); }
  };

  const upload = async () => {
    if (!blob) return;
    setUploading(true); setError('');
    try { const c = await uploadToIpfs(blob); setCid(c); }
    catch (e) { setError('Upload failed: ' + e.message); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (!cid || !hash) return;
    setBusy(true); setError('');
    const t = toastOp('Submit return');
    try {
      const result = await api.requestReturn(Number(loanId), cid, hash, (state) => {
        if (state === 'waiting') t.signing();
        if (state === 'confirming') t.confirming();
        if (state === 'done') t.done('Return submitted');
      });
      setReceipt(result?.opHash);
    } catch (e) { setError(e.message); t.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <Toaster position="top-right" />
      <button onClick={() => nav(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors">
        <ArrowLeft size={15} /> Back
      </button>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Submit return — loan #{loanId}</h1>

      {receipt ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-3">
          <div className="flex items-center gap-2 text-green-700 font-medium">
            <CheckCircle size={18} /> Return submitted.
          </div>
          <p className="text-sm text-gray-600">Signed by student. Admin must approve the return next.</p>
          <Receipt opHash={receipt} label="Your transaction:" />
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <p className="text-sm text-gray-600">Take a photo of the equipment as you return it. This creates an on-chain record.</p>
          <label className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 transition-colors">
            <Camera size={22} className="text-gray-400 mb-2" />
            <span className="text-sm text-gray-500">Take a return photo</span>
            <input type="file" accept="image/*" capture="environment" onChange={onFileChange} className="sr-only" />
          </label>
          {previewUrl && <img src={previewUrl} alt="Preview" className="h-44 object-contain w-full rounded-lg border border-gray-200" />}
          {hash && <Fingerprint label="Photo fingerprint (SHA-256)" value={hash} />}
          {cid && <Fingerprint label="IPFS CID" value={cid} />}
          {error && <div className="text-red-600 bg-red-50 p-3 rounded-md text-sm border border-red-200">{error}</div>}
          {blob && !cid && (
            <button onClick={upload} disabled={uploading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-md text-sm transition-colors">
              {uploading ? 'Uploading...' : 'Upload photo to IPFS'}
            </button>
          )}
          {cid && (
            <button onClick={submit} disabled={busy}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-md text-sm transition-colors">
              {busy ? 'Waiting for Temple...' : 'Submit return'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
