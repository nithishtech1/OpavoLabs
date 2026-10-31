import { ExternalLink } from 'lucide-react';

const EXPLORER = import.meta.env.VITE_EXPLORER || import.meta.env.VITE_EXPLORER_BASE || 'https://shadownet.tzkt.io';

export default function Receipt({ opHash, label = 'Transaction receipt:' }) {
  if (!opHash) return null;
  const isMock = String(opHash).startsWith('oomock') || String(opHash).startsWith('mock');
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md p-2.5 my-2">
      <span className="font-medium text-gray-800">{label}</span>
      {isMock ? (
        <code className="font-mono text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{opHash}</code>
      ) : (
        <a
          href={`${EXPLORER}/${opHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline font-semibold"
        >
          <span>{opHash.slice(0, 10)}...{opHash.slice(-8)}</span>
          <ExternalLink size={12} />
        </a>
      )}
      {!isMock && <span className="text-xs text-gray-400">(TzKT Shadownet)</span>}
    </div>
  );
}
