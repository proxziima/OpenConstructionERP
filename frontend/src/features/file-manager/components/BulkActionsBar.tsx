/** Bulk-actions bar — visible when one or more files are selected.
 *
 * Currently supports bulk delete via the documents-module batch endpoint.
 * Other bulk operations (classify, export-selection) are TODO — once
 * file_manager exposes them, wire them through this same bar.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Trash2, X, Loader2 } from 'lucide-react';
import { apiPost } from '@/shared/lib/api';
import { useToastStore } from '@/stores/useToastStore';
import { fileManagerKeys } from '../hooks';
import type { FileRow } from '../types';

interface BulkActionsBarProps {
  selectedRows: FileRow[];
  projectId: string;
  onClear: () => void;
}

export function BulkActionsBar({ selectedRows, projectId, onClear }: BulkActionsBarProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const [confirming, setConfirming] = useState(false);

  // Only document-kind rows can be deleted via this endpoint today.
  // Other kinds (BIM, DWG, photos) own their own delete endpoints — TODO:
  // route bulk deletes through file_manager once it exposes a unified
  // delete API.
  const deletableIds = selectedRows
    .filter((r) => r.kind === 'document')
    .map((r) => r.id);

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) =>
      apiPost<{ requested: number; deleted: number }, { ids: string[] }>(
        '/v1/documents/batch/delete/',
        { ids },
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [fileManagerKeys.tree, projectId] });
      queryClient.invalidateQueries({ queryKey: [fileManagerKeys.list, projectId] });
      addToast({
        type: 'success',
        title: t('files.bulk.deleted', {
          defaultValue: '{{count}} file(s) deleted',
          count: data?.deleted ?? deletableIds.length,
        }),
      });
      setConfirming(false);
      onClear();
    },
    onError: (err: Error) => {
      addToast({
        type: 'error',
        title: t('files.bulk.delete_failed', { defaultValue: 'Bulk delete failed' }),
        message: err.message,
      });
      setConfirming(false);
    },
  });

  if (selectedRows.length === 0) return null;

  const skipped = selectedRows.length - deletableIds.length;

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border-light bg-oe-blue/5">
      <span className="text-xs font-medium text-content-primary">
        {t('files.bulk.n_selected', {
          defaultValue: '{{count}} selected',
          count: selectedRows.length,
        })}
      </span>

      <button
        type="button"
        onClick={onClear}
        className="text-2xs text-content-tertiary hover:text-content-primary underline-offset-2 hover:underline"
      >
        {t('files.bulk.clear', { defaultValue: 'Clear' })}
      </button>

      <div className="ms-auto flex items-center gap-2">
        {confirming ? (
          <div className="flex items-center gap-2 animate-fade-in">
            <span className="text-2xs text-semantic-error font-medium">
              {t('files.bulk.confirm_delete', {
                defaultValue: 'Delete {{count}} file(s)?',
                count: deletableIds.length,
              })}
            </span>
            {skipped > 0 && (
              <span className="text-2xs text-content-tertiary">
                {t('files.bulk.skip_unsupported', {
                  defaultValue: '{{count}} skipped (unsupported)',
                  count: skipped,
                })}
              </span>
            )}
            <button
              type="button"
              disabled={deleteMutation.isPending || deletableIds.length === 0}
              onClick={() => deleteMutation.mutate(deletableIds)}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-2xs font-semibold bg-semantic-error text-white hover:opacity-90 disabled:opacity-50"
            >
              {deleteMutation.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Trash2 size={12} />
              )}
              {t('files.bulk.delete', { defaultValue: 'Delete' })}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-content-tertiary hover:bg-surface-secondary"
              aria-label={t('common.cancel', { defaultValue: 'Cancel' })}
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={deletableIds.length === 0}
            onClick={() => setConfirming(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border border-border-light text-content-secondary hover:bg-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              deletableIds.length === 0
                ? t('files.bulk.no_deletable', {
                    defaultValue: 'Selected files cannot be deleted from here yet',
                  })
                : undefined
            }
          >
            <Trash2 size={13} />
            {t('files.bulk.delete', { defaultValue: 'Delete' })}
          </button>
        )}
      </div>
    </div>
  );
}
