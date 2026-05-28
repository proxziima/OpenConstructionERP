/**
 * PartnerLogoBadge — co-branding strip shown on every page when a
 * partner pack is active.
 *
 * Variants:
 *  - "nav"      — slim chip with partner logo + "in partnership with X",
 *                 mounted in the top nav-bar center where space allows.
 *  - "dashboard" — wider banner with logo + powered-by line, mounted at
 *                 the top of the dashboard.
 *
 * Dismiss behaviour: the user can hide the badge for the current session
 * via a small ✕. We persist the dismissal to ``sessionStorage`` so it
 * comes back on next browser launch — matches the product spec ("logo
 * can be hidden but reappears on next launch").
 */

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePartnerPack, partnerLogoUrl } from '@/shared/hooks/usePartnerPack';

const SESSION_DISMISS_KEY = 'partner-pack:dismissed';

interface PartnerLogoBadgeProps {
  variant: 'nav' | 'dashboard';
  className?: string;
}

export function PartnerLogoBadge({ variant, className = '' }: PartnerLogoBadgeProps) {
  const packQ = usePartnerPack();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(SESSION_DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (dismissed) {
      try {
        sessionStorage.setItem(SESSION_DISMISS_KEY, '1');
      } catch {
        /* ignore — sessionStorage may be unavailable */
      }
    }
  }, [dismissed]);

  if (packQ.isLoading || !packQ.data?.active || dismissed) return null;

  const m = packQ.data.manifest!;
  const url = m.partner_url ?? '#';
  const isExternal = m.partner_url && /^https?:\/\//.test(m.partner_url);

  if (variant === 'nav') {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-full bg-surface-secondary/60 px-2.5 py-1 text-xs text-content-secondary backdrop-blur ${className}`}
        data-testid="partner-logo-nav"
      >
        <a
          href={url}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noreferrer' : undefined}
          className="inline-flex items-center gap-1.5 hover:text-content-primary"
          title={m.branding.powered_by_text}
        >
          {m.branding.has_logo && (
            <img
              src={partnerLogoUrl()}
              alt={`${m.partner_name} logo`}
              className="h-4 w-auto"
            />
          )}
          <span className="font-medium">{m.partner_name}</span>
        </a>
        <button
          type="button"
          aria-label="Hide partner badge"
          onClick={() => setDismissed(true)}
          className="rounded p-0.5 text-content-tertiary hover:text-content-primary hover:bg-surface-tertiary"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  // variant === 'dashboard'
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-secondary/50 px-4 py-2 text-sm ${className}`}
      data-testid="partner-logo-dashboard"
    >
      <a
        href={url}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noreferrer' : undefined}
        className="flex items-center gap-3 hover:opacity-90"
      >
        {m.branding.has_logo && (
          <img
            src={partnerLogoUrl()}
            alt={`${m.partner_name} logo`}
            className="h-8 w-auto"
          />
        )}
        <div className="leading-tight">
          <div className="text-xs uppercase tracking-wide text-content-tertiary">
            {m.branding.powered_by_text}
          </div>
          {m.description && (
            <div className="text-xs text-content-secondary mt-0.5 max-w-2xl">
              {m.description}
            </div>
          )}
        </div>
      </a>
      <button
        type="button"
        aria-label="Hide partner badge"
        onClick={() => setDismissed(true)}
        className="rounded p-1 text-content-tertiary hover:text-content-primary hover:bg-surface-tertiary"
      >
        <X size={14} />
      </button>
    </div>
  );
}
