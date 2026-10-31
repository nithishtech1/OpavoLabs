import { useState, useEffect } from 'react';
import { ShieldCheck, Upload, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { compressImage } from '../lib/image.js';
import { sha256Hex } from '../lib/hash.js';
import { verifyPhoto, flipOneByte } from '../lib/verify.js';
import { photoUrl } from '../lib/ipfs.js';
import { Fingerprint, VerifyVerdict } from '../components/FingerprintDisplay.jsx';
import * as api from '../lib/chain-api.js';

export default function VerifyPage() {
  const [loans, setLoans] = useState([]);
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [targetCid, setTargetCid] = useState('');
  const [targetHash, setTargetHash] = useState('');
  const [localFile, setLocalFile] = useState(null);
  const [computedHash, setComputedHash] = useState('');
  const [verdict, setVerdict] = useState(null); // { match, computed, onchain, simulated }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.listLoans().then(list => {
      setLoans(list);
      const withPhoto = list.find(l => l.checkoutCid && l.checkoutHash);
      if (withPhoto) {
        setSelectedLoanId(String(withPhoto.id));
        setTargetCid(withPhoto.checkoutCid);
        setTargetHash(withPhoto.checkoutHash);
      }
    }).catch(() => {});
  }, []);

  const onSelectLoan = (e) => {
    const id = e.target.value;
    setSelectedLoanId(id);
    setVerdict(null);
    if (!id) return;
    const l = loans.find(x => x.id === Number(id));
    if (l) {
      setTargetCid(l.checkoutCid || '');
      setTargetHash(l.checkoutHash || '');
    }
  };

  const handleVerify = async (simulate = false) => {
    if (!targetCid && !localFile) {
      setError('Please provide an IPFS CID or choose a local file.');
      return;
    }
    setBusy(true); setError(''); setVerdict(null);
    try {
      const res = await verifyPhoto({
        cid: targetCid,
        onchainHash: targetHash,
        file: localFile,
        simulateTamper: simulate,
      });
      setVerdict(res);
      setComputedHash(res.computed);
    } catch (e) {
      setError('Verification failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const onFileChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLocalFile(f);
    setVerdict(null);
    try {
      const compressed = await compressImage(f);
      const h = await sha256Hex(compressed);
      setComputedHash(h);
    } catch (err) {
      setError('Failed reading file: ' + err.message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <ShieldCheck className="text-blue-600" size={24} />
          Tamper-Proof Verification
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Verify photos against immutable cryptographic fingerprints recorded on Tezos Shadownet.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        {loans.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Load from on-chain loan record</label>
            <select
              value={selectedLoanId}
              onChange={onSelectLoan}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Choose a loan record --</option>
              {loans.map(l => (
                <option key={l.id} value={l.id}>
                  Loan #{l.id} ({l.status}) - Eq #{l.equipmentId}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">IPFS CID</label>
          <input
            type="text"
            value={targetCid}
            onChange={e => { setTargetCid(e.target.value); setVerdict(null); }}
            placeholder="e.g. bafkrei..."
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Recorded On-Chain Hash (SHA-256)</label>
          <input
            type="text"
            value={targetHash}
            onChange={e => { setTargetHash(e.target.value); setVerdict(null); }}
            placeholder="64 hex chars recorded on contract"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {targetCid && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Preview from IPFS Gateway:</p>
            <img
              src={photoUrl(targetCid)}
              alt="IPFS preview"
              className="h-44 object-contain rounded-md border border-gray-200 w-full bg-gray-50"
            />
          </div>
        )}

        <div className="pt-2 border-t border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">Or verify a local photo file directly</label>
          <input type="file" accept="image/*" onChange={onFileChange} className="text-sm text-gray-500" />
        </div>

        {error && <div className="text-red-600 bg-red-50 p-3 rounded-md text-sm border border-red-200">{error}</div>}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={() => handleVerify(false)}
            disabled={busy || (!targetCid && !localFile) || !targetHash}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-md text-sm transition-colors"
          >
            {busy ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={16} />}
            Verify Authenticity
          </button>
          <button
            onClick={() => handleVerify(true)}
            disabled={busy || (!targetCid && !localFile) || !targetHash}
            className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-medium px-4 py-2 rounded-md text-sm transition-colors"
          >
            <AlertTriangle size={16} />
            Simulate Tampering (1 bit flip)
          </button>
        </div>
      </div>

      {verdict && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Verification Verdict</h2>
          <VerifyVerdict localHash={verdict.computed} remoteHash={verdict.onchain} />
          {verdict.simulated && (
            <p className="text-xs text-red-600 mt-2">
              * Simulation active: Exactly one byte in the image payload was flipped to demonstrate that any tampering is mathematically detected.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
