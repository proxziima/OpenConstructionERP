/** PathBar — top strip showing the project's resolved storage roots. */

import { useState } from 'react';
import { Copy, Folder, ChevronRight, Database, Image as ImageIcon, FileText, Box, Pencil } from 'lucide-react';
import type { StorageLocations } from '../types';
import { copyToClipboard, isTauri, openInOSFinder } from '../lib/tauri';

interface PathBarProps {
  locations: StorageLocations | undefined;
  isLoading: boolean;
  selectedKind?: string | null;
}

const KIND_TO_ROOT: Record<string, keyof StorageLocations> = {
  document: 'uploads_root',
  photo: 'photos_root',
  sheet: 'sheets_root',
  bim_model: 'bim_root',
  dwg_drawing: 'dwg_root',
};

export function PathBar({ locations, isLoading, selectedKind }: PathBarProps) {
  const [copied, setCopied] = useState<string | null>(null);

  if (isLoading || !locations) {
    return (
      <div className="px-4 py-2 text-xs text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800">
        Loading storage locations…
      </div>
    );
  }

  const rootKey = (selectedKind && KIND_TO_ROOT[selectedKind]) || 'uploads_root';
  const activeRoot = (locations[rootKey] as string | null) || locations.uploads_root || '';
  const segments = activeRoot ? activeRoot.split(/[\\/]/).filter(Boolean) : [];

  async function handleCopy(text: string) {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    }
  }

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
      <div className="px-4 py-2 flex items-center gap-2 text-xs">
        <Folder className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <div className="flex items-center gap-1 flex-wrap min-w-0">
          {segments.length === 0 ? (
            <span className="text-slate-500">No path resolved</span>
          ) : (
            segments.map((seg, idx) => (
              <span key={`${seg}-${idx}`} className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                {idx > 0 && <ChevronRight className="h-3 w-3 text-slate-400" />}
                <span className="font-mono">{seg}</span>
              </span>
            ))
          )}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleCopy(activeRoot)}
            disabled={!activeRoot}
            className="px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 dark:text-slate-300 inline-flex items-center gap-1"
            title="Copy path"
          >
            <Copy className="h-3 w-3" />
            {copied === activeRoot ? 'Copied' : 'Copy'}
          </button>
          {isTauri && activeRoot && (
            <button
              type="button"
              onClick={() => openInOSFinder(activeRoot)}
              className="px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 inline-flex items-center gap-1"
              title="Open in Explorer / Finder"
            >
              <Folder className="h-3 w-3" />
              Open
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pb-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 text-[11px]">
        <RootChip label="DB" icon={<Database className="h-3 w-3" />} value={locations.db_path} onCopy={handleCopy} />
        <RootChip label="Uploads" icon={<FileText className="h-3 w-3" />} value={locations.uploads_root} onCopy={handleCopy} />
        <RootChip label="Photos" icon={<ImageIcon className="h-3 w-3" />} value={locations.photos_root} onCopy={handleCopy} />
        <RootChip label="BIM" icon={<Box className="h-3 w-3" />} value={locations.bim_root} onCopy={handleCopy} />
        <RootChip label="DWG" icon={<Pencil className="h-3 w-3" />} value={locations.dwg_root} onCopy={handleCopy} />
      </div>

      {locations.notes.length > 0 && (
        <div className="px-4 pb-2 space-y-1">
          {locations.notes.map((note, i) => (
            <p key={i} className="text-[11px] text-amber-700 dark:text-amber-400 italic">
              ⚠ {note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function RootChip({
  label,
  icon,
  value,
  onCopy,
}: {
  label: string;
  icon: React.ReactNode;
  value: string | null;
  onCopy: (v: string) => void;
}) {
  if (!value) {
    return (
      <div className="rounded border border-dashed border-slate-300 dark:border-slate-700 px-2 py-1 text-slate-400 dark:text-slate-500 inline-flex items-center gap-1.5">
        {icon}
        <span>{label}: —</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onCopy(value)}
      className="rounded border border-slate-200 dark:border-slate-700 px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 truncate text-left"
      title={`Click to copy: ${value}`}
    >
      {icon}
      <span className="font-medium">{label}:</span>
      <span className="truncate font-mono">{value}</span>
    </button>
  );
}
