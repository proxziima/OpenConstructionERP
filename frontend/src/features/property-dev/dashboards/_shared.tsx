/**
 * Shared helpers for the R6 Property-Dev dashboards.
 *
 * Centralises the status palette, loading/empty primitives, and small
 * formatting helpers used across all six dashboards.
 */

import { Loader2, Inbox } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PlotStatus } from '../api';

export const PLOT_STATUS_FILL: Record<string, string> = {
  planned: '#94a3b8',
  under_construction: '#f59e0b',
  ready: '#10b981',
  reserved: '#3b82f6',
  under_contract: '#0ea5e9',
  sold: '#8b5cf6',
  handed_over: '#6366f1',
  maintenance: '#f43f5e',
};

export const PLOT_STATUS_STROKE: Record<string, string> = {
  planned: '#64748b',
  under_construction: '#d97706',
  ready: '#059669',
  reserved: '#2563eb',
  under_contract: '#0284c7',
  sold: '#7c3aed',
  handed_over: '#4f46e5',
  maintenance: '#e11d48',
};

export const ALL_PLOT_STATUSES: PlotStatus[] = [
  'planned',
  'under_construction',
  'ready',
  'reserved',
  'sold',
  'handed_over',
];

export function DashboardLoading({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 py-12 text-sm text-content-tertiary"
    >
      <Loader2 size={16} className="animate-spin" />
      <span>{label ?? t('common.loading', { defaultValue: 'Loading…' })}</span>
    </div>
  );
}

export function DashboardEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-secondary">
        <Inbox size={18} className="text-content-tertiary" />
      </div>
      <h4 className="text-sm font-semibold text-content-primary">{title}</h4>
      {description && (
        <p className="text-xs text-content-tertiary max-w-md">{description}</p>
      )}
      {action}
    </div>
  );
}

export function StatusLegend() {
  const { t } = useTranslation();
  return (
    <div
      className="flex flex-wrap items-center gap-3 px-3 py-2 text-2xs text-content-tertiary"
      aria-label={t('propdev.dashboards.status_legend', {
        defaultValue: 'Status legend',
      })}
    >
      {ALL_PLOT_STATUSES.map((s) => (
        <div key={s} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-3 rounded-sm"
            style={{ backgroundColor: PLOT_STATUS_FILL[s] }}
            aria-hidden="true"
          />
          <span>
            {t(`propdev.status.${s}`, {
              defaultValue: s.replace(/_/g, ' '),
            })}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Format a numeric value to compact notation (1.2M / 540K). */
export function fmtCompactNumber(value: number, locale = 'en-US'): string {
  if (!Number.isFinite(value)) return '0';
  const abs = Math.abs(value);
  if (abs >= 1_000_000)
    return `${(value / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 2 })}M`;
  if (abs >= 1_000)
    return `${(value / 1_000).toLocaleString(locale, { maximumFractionDigits: 1 })}K`;
  return value.toLocaleString(locale, { maximumFractionDigits: 0 });
}

/** Convert a `Decimal` / `string` / `number` payload field to JS number. */
export function num(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Sum a list of CurrencyAmount entries into a {currency: number} map. */
export function sumByCurrency(
  rows: { currency: string; amount: number | string }[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    out[r.currency] = (out[r.currency] ?? 0) + num(r.amount);
  }
  return out;
}

/** Quartile bucket (0..3) for a numeric drop-off percentage. */
export function dropQuartile(pct: number): 0 | 1 | 2 | 3 {
  if (pct < 25) return 0;
  if (pct < 50) return 1;
  if (pct < 75) return 2;
  return 3;
}
