# AI Quick Estimate audit — partial close (2026-05-24)

Backend cost-tracking gap CLOSED in v4.7.x (alembic v3128, shared
helper at `app/core/ai/pricing.py`, both `ai` and `clash_ai_triage`
modules write `cost_usd_estimate` from the same MODEL_COSTS table).

Still open and owned by the frontend a11y / functional-polish wave:

* [x] 114 missing `ai.*` i18n keys in en.ts — CLOSED 2026-05-28. Actual
  gap was 134 keys (audit count was stale; more keys had been added to
  the page since 2026-05-24). All 210 `ai.*` keys called by
  `QuickEstimatePage.tsx` + `AdvisorPage.tsx` now have English
  fallbacks in `frontend/src/app/locales/en.ts`. Template-literal
  defaults (`${data.foo}`) were promoted to i18next `{{var}}` form so
  the values are translatable, not interpolated by JS. Other locales
  fall back to English until a later wave fills them.
* 10 a11y findings (4×P1 + 6×P2) — see `__a11y_followups.md`.
* `useLLMRun()` shared-hook extraction — see `__shared_hook_proposal.md`.
* Lift `formatNumber` / `formatFileSize` / `getFileExtension` into
  `@/shared/lib/formatters` (not AI-specific).
