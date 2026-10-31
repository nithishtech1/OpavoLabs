import { useState } from 'react';
import { Copy, Check, ChevronDown } from 'lucide-react';

function short(hex) { return hex ? hex.slice(0, 8) + '...' + hex.slice(-6) : ''; }

export function Fingerprint({ label, value }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  if (!value) return null;
  const copy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="text-sm">
      <div className="flex items-center gap-2">
        <span className="text-gray-500">{label}:</span>
        <code className="font-mono text-gray-800">{expanded ? value : short(value)}</code>
        <button onClick={copy} className="text-gray-400 hover:text-gray-700 p-0.5" title="Copy">
          {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
        </button>
        <button onClick={() => setExpanded(e => !e)} className="text-gray-400 hover:text-gray-700 p-0.5">
          <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
}

export function VerifyVerdict({ localHash, remoteHash }) {
  if (!localHash || !remoteHash) return null;
  const match = localHash.toLowerCase() === remoteHash.toLowerCase();
  return (
    <div className={`mt-4 p-4 rounded-lg border-2 transition-all ${match
      ? 'bg-green-50 border-green-400 text-green-800'
      : 'bg-red-50 border-red-400 text-red-800'
    }`}>
      <p className="font-semibold text-base">{match ? 'Photo verified: unchanged since handover' : 'Photo does not match the record'}</p>
      <div className="mt-2 space-y-1">
        <Fingerprint label="Recorded (photo fingerprint)" value={remoteHash} />
        <Fingerprint label="Retrieved (photo fingerprint)" value={localHash} />
      </div>
    </div>
  );
}
