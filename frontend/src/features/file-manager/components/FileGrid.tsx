/** Grid view of files — default right-pane layout. */

import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { FileText, Image as ImageIcon, Layout, Box, Pencil, File, PenTool, FileBarChart, Tag } from 'lucide-react';
import { DateDisplay } from '@/shared/ui/DateDisplay';
import type { FileRow, FileKind } from '../types';

const KIND_ICON: Record<FileKind, typeof FileText> = {
  document: FileText,
  photo: ImageIcon,
  sheet: Layout,
  bim_model: Box,
  dwg_drawing: Pencil,
  takeoff: Tag,
  report: FileBarChart,
  markup: PenTool,
};

const KIND_TINT: Record<FileKind, string> = {
  document: 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400',
  photo: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400',
  sheet: 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400',
  bim_model: 'bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400',
  dwg_drawing: 'bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400',
  takeoff: 'bg-cyan-50 dark:bg-cyan-950/20 text-cyan-600 dark:text-cyan-400',
  report: 'bg-pink-50 dark:bg-pink-950/20 text-pink-600 dark:text-pink-400',
  markup: 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400',
};

interface FileGridProps {
  items: FileRow[];
  selectedIds: Set<string>;
  onSelect: (id: string, additive: boolean) => void;
  onOpen: (row: FileRow) => void;
  isLoading?: boolean;
}

function fmtBytes(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function FileGrid({ items, selectedIds, onSelect, onOpen, isLoading }: FileGridProps) {
  const { t } = useTranslation();

  if (isLoading && items.length === 0) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[4/5] rounded-xl border border-border-light bg-surface-secondary/40 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center text-content-tertiary">
        <File size={28} className="mb-3 opacity-60" />
        <p className="text-sm">{t('files.empty', { defaultValue: 'No files match your filters.' })}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 p-4">
      {items.map((row) => {
        const Icon = KIND_ICON[row.kind] ?? File;
        const tint = KIND_TINT[row.kind] ?? 'bg-surface-secondary text-content-secondary';
        const isSelected = selectedIds.has(row.id);
        return (
          <button
            key={row.id}
            type="button"
            onClick={(e) => onSelect(row.id, e.metaKey || e.ctrlKey)}
            onDoubleClick={() => onOpen(row)}
            className={clsx(
              'group relative flex flex-col rounded-xl border bg-surface-elevated text-left transition-all',
              'overflow-hidden',
              isSelected
                ? 'border-oe-blue ring-2 ring-oe-blue/30 shadow-md'
                : 'border-border-light hover:border-border hover:shadow-sm',
            )}
            title={row.name}
          >
            <div className={clsx('relative aspect-[4/3] flex items-center justify-center', tint)}>
              {row.thumbnail_url ? (
                <img
                  src={row.thumbnail_url}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Icon size={32} strokeWidth={1.5} />
              )}
              {row.extension && (
                <span className="absolute bottom-1.5 left-1.5 px-1.5 py-px rounded bg-black/60 text-white text-[9px] font-mono uppercase tracking-wide">
                  {row.extension.replace(/^\./, '')}
                </span>
              )}
            </div>
            <div className="px-2.5 py-2 min-w-0">
              <p className="text-xs font-medium text-content-primary truncate" title={row.name}>
                {row.name}
              </p>
              <div className="mt-0.5 flex items-center justify-between text-[10px] text-content-tertiary tabular-nums">
                <span>{fmtBytes(row.size_bytes)}</span>
                {row.modified_at && (
                  <DateDisplay value={row.modified_at} format="relative" className="ms-2 shrink-0" />
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
