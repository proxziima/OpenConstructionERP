// Apply-action affordances for a completed agent run (Item 29).
//
// When an agent's output contains structured BOQ-position proposals, this
// surfaces them clearly and offers a safe next step: review them in the BOQ
// editor (deep-link to the active project) and copy the structured JSON. Per
// the architecture guide "AI-augmented, human-confirmed", we never auto-write
// the BOQ here - the user confirms every position in the BOQ editor. Direct
// posting (and approval-routes integration) is deliberately out of scope for
// this increment; this component makes the proposal actionable without
// crossing into another module's write path.
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ListChecks, Copy, Check, ArrowRight } from 'lucide-react';
import clsx from 'clsx';

import { useProjectContextStore } from '@/stores/useProjectContextStore';
import { copyToClipboard } from '@/shared/lib/browser';

// ── Proposal detection ───────────────────────────────────────────────────────

interface PositionProposal {
  description: string;
  unit: string;
  qty: number;
  unit_rate: number;
  total: number;
  currency: string;
}

function asNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isPositionLike(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Record<string, unknown>).description === 'string' &&
    'unit' in v
  );
}

/** Pull BOQ-position proposals out of an agent's final output, if any. */
export function extractPositionProposals(text: string): PositionProposal[] {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return [];
  }
  // Accept: a single proposal, an array of proposals, or { positions: [...] }.
  let candidates: unknown[] = [];
  if (Array.isArray(parsed)) candidates = parsed;
  else if (isPositionLike(parsed)) candidates = [parsed];
  else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const arr = obj.positions ?? obj.proposals ?? obj.items;
    if (Array.isArray(arr)) candidates = arr;
    else if (isPositionLike(parsed)) candidates = [parsed];
  }

  return candidates.filter(isPositionLike).map((c) => {
    const qty = asNumber(c.qty ?? c.quantity);
    const rate = asNumber(c.unit_rate ?? c.rate);
    return {
      description: String(c.description ?? '').trim(),
      unit: String(c.unit ?? '').trim(),
      qty,
      unit_rate: rate,
      total: asNumber(c.total) || Number((qty * rate).toFixed(2)),
      currency: String(c.currency ?? '').trim().toUpperCase(),
    };
  });
}

interface ApplyActionButtonProps {
  /** The run's final output text. */
  output: string;
}

export function ApplyActionButton({ output }: ApplyActionButtonProps): JSX.Element | null {
  const { t } = useTranslation();
  const projectId = useProjectContextStore((s) => s.activeProjectId);
  const [copied, setCopied] = useState(false);

  const proposals = useMemo(() => extractPositionProposals(output), [output]);
  if (proposals.length === 0) return null;

  // Money rule: never blend currencies. Only show a combined total when every
  // proposal shares the same currency; otherwise show the count only.
  const currencies = new Set(proposals.map((p) => p.currency).filter(Boolean));
  const singleCurrency = currencies.size === 1 ? [...currencies][0] : null;
  const combinedTotal = singleCurrency
    ? proposals.reduce((sum, p) => sum + p.total, 0)
    : null;

  const onCopy = () => {
    void copyToClipboard(JSON.stringify(proposals, null, 2)).then((ok) => {
      if (ok) {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
    });
  };

  return (
    <div className="rounded-lg border border-oe-blue/30 bg-oe-blue-subtle/50 p-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-oe-blue-text">
        <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
        {t('agents.apply.title', { defaultValue: 'BOQ positions proposed' })}
      </div>
      <p className="mt-1 text-xs text-content-secondary">
        {t('agents.apply.detected', {
          defaultValue: '{{count}} position(s) detected. Review them in the BOQ editor before applying — nothing is added automatically.',
          count: proposals.length,
        })}
      </p>

      <ul className="mt-2 space-y-1">
        {proposals.slice(0, 5).map((p, i) => (
          <li
            key={`${p.description}-${i}`}
            className="flex items-center justify-between gap-3 rounded-md bg-surface-elevated/70 px-2.5 py-1.5 text-xs"
          >
            <span className="min-w-0 truncate text-content-primary">{p.description || '—'}</span>
            <span className="shrink-0 text-content-tertiary">
              {p.qty} {p.unit}
              {p.currency ? ` · ${p.total} ${p.currency}` : ''}
            </span>
          </li>
        ))}
        {proposals.length > 5 && (
          <li className="px-2.5 text-2xs text-content-tertiary">
            {t('agents.apply.more', {
              defaultValue: '+{{count}} more',
              count: proposals.length - 5,
            })}
          </li>
        )}
      </ul>

      {combinedTotal !== null && singleCurrency && (
        <p className="mt-2 text-xs font-medium text-content-secondary">
          {t('agents.apply.combined_total', { defaultValue: 'Combined total' })}:{' '}
          {combinedTotal.toFixed(2)} {singleCurrency}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {projectId ? (
          <Link
            to={`/projects/${projectId}/boq`}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-lg bg-oe-blue px-3 py-1.5 text-xs font-semibold text-content-inverse transition-all',
              'hover:bg-oe-blue-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oe-blue focus-visible:ring-offset-2',
            )}
          >
            {t('agents.apply.review_in_boq', { defaultValue: 'Review in BOQ editor' })}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : (
          <span className="text-2xs text-content-tertiary">
            {t('agents.apply.no_project', {
              defaultValue: 'Open a project to review these positions in its BOQ.',
            })}
          </span>
        )}
        <button
          type="button"
          onClick={onCopy}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-lg border border-border-light px-3 py-1.5 text-xs font-medium transition-colors',
            copied
              ? 'text-semantic-success'
              : 'text-content-secondary hover:bg-surface-secondary hover:text-content-primary',
          )}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied
            ? t('agents.copied', { defaultValue: 'Copied' })
            : t('agents.apply.copy_json', { defaultValue: 'Copy as JSON' })}
        </button>
      </div>
    </div>
  );
}

export default ApplyActionButton;
