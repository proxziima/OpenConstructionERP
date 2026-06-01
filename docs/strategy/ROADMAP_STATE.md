# OpenConstructionERP - Roadmap Build State

> Single resumable control file. Any agent or fresh session resuming this work reads THIS file first, then `IMPLEMENTATION_PLAN.md`. It records what we are building, the locked decisions, the hard constraints, the alembic chain, the dev environment, and exactly where we are. Keep the Status board and Progress log current as work proceeds.

## LIVE RUN STATUS (2026-06-01, autonomous long run)

Founder directive: work continuously, implement everything so all modules work together on the PostgreSQL foundation, run full E2E (real clicks, screenshots, logic verification) at the end, then publish ONCE as a new version (target v6.4.0). Do not publish intermediate versions.

WORKING TREE WARNING: a large uncommitted changeset is on disk (accumulated 6.3.x fixes plus this run's work). DO NOT `git reset --hard`, `git stash`, or `git clean` - that destroys hours of work (see memory `zombie_bg_task_stash_pop`). Commit at clean milestones; tag/publish only at the very end. New untracked source that MUST be committed at milestone: `backend/openconstructionerp/` (launcher), `backend/app/modules/daily_diary/pdf_export.py`, `backend/app/modules/match_elements/{matchers/llm.py,pdf_import.py,sources/pdf_adapter.py}`, new tests under `backend/tests/`, `frontend/src/features/geo-hub/__tests__/`, `docs/strategy/`. Exclude scratch: `_*`, `_flagship/`, `_frontend_dist_prev/`, `*.txt`, `HANDOVER_NEW_AGENT.md`.

DONE + VERIFIED this run:
- Login SQLite write-lock fix (`users/service.py`): `last_login_at` written in the request session, not a detached `asyncio` task that opened a second connection and locked the next request. Verified: match 20/20, demo-login 6/6, auth-timing 1/1; demo-login confirmed on embedded PG.
- Geo 3D model + overlay fix: NEW backend route `GET /api/v1/geo-hub/tilesets/{id}/artifact/{filename}` streams `tileset.json` + tiles (`geo_hub/service.py:get_tileset_artifact_bytes`, `router.py`). Frontend loads tileset + raster through a Cesium `Resource` carrying the bearer token (`CesiumViewer.tsx`, `OverlayLayer.tsx`, `api.ts:geoAuthHeaders/tilesetArtifactUrl`). Root cause: the DB stored a bare storage key with no serving route, so Cesium got `index.html` back; rasters/tilesets also lacked auth. Verified on real Houston tileset `d346a4b2`: `tileset.json` 200 JSON, `tile_0.b3dm` 200 5.58MB, 401 no-token, 404 traversal. Frontend rebuilt + mirrored to `_frontend_dist`.
- Top-menu Documentation link -> `https://openconstructionerp.com/docs` (`Header.tsx`), live 200.
- `backend/README.md` stale "SQLite" -> embedded PostgreSQL; branded `python -m openconstructionerp` launcher.
- Version files currently at 6.3.1; re-bump to 6.4.0 at the end.

PG base: dedicated `tests/pg` lane green (19 passed) on embedded PostgreSQL - safe to build on.

Partner-packs investigation (agent, complete): the activate flow works end to end and is fail-soft, and the SSE step contract matches the dialog. Problems found: BLOCKER the developer guide documents `openestimate module install <zip>` but no `module` CLI subcommand exists; MAJOR stale "v4.3 / 110+ modules" claim in the guide; MAJOR resources-count shows 0 on already-loaded cost regions (already-loaded branch of load_cwicr_region omits resource_components); MINOR genuine em-dashes in shipped pack/demo strings; MINOR the i18n-fallbacks instruction points at the test-only file.

DONE this run (partner-packs):
- BLOCKER resolved by implementation: real `module install`/`list`/`uninstall` CLI in backend/app/cli.py (static ast manifest parse - never executes untrusted code, rejects path traversal/absolute/drive-letter/symlink/multi-top-dir, atomic move into app/modules/<dir> where dir = name.removeprefix("oe_")). Both `openconstructionerp` and `openestimate` console scripts work; canonical is `openconstructionerp module install <zip>`. Verified live against malicious archives + happy path, nothing left in repo.
- MAJOR resources-count fix: costs/router.py load_cwicr_region already-loaded branch now returns true `resource_components` (dialect-portable json_array_length/jsonb_array_length sum), so the partner-pack installer progress + summary stop reporting 0 on already-loaded regions.
- MINOR em-dash purge: 489 genuine U+2014 replaced with hyphens in the REAL user-facing demo content (backend/app/core/demo_projects.py + backend/app/core/demo_packs/*.py, 20 files, accents preserved, py_compile clean). NOTE: there is no backend/app/core/partner_pack/packs/<slug>/manifest.py tree (that path only exists in the stale _frontend_dist_prev bundle); the prior investigation's pack-manifest em-dash locations were a false lead. 168 U+2014 remain in backend/app/core/partner_pack/*.py but are all developer-facing (comments/docstrings/log) - left intentionally.

DONE this run (guide text + cost-spine backend):
- Guide text + en.ts: CLI command -> canonical `openconstructionerp` brand; stale "v4.3 / 110+ modules" dropped (en.ts:2286 + TSX); i18n guidance corrected to locales/en + inline defaultValue (en.ts:2350/2359 + TSX); ModuleDeveloperGuide.tsx swept em-dash-free (44 more replaced). Frontend tsc exit 0 GREEN - after also fixing my own geo type gap: `CesiumLike` was missing `Resource` (my geo fix used `new cesium.Resource(...)`); added the Resource ctor + widened Cesium3DTileset.fromUrl to `string|object` in CesiumViewer.tsx (runtime always worked since esbuild strips types).
- v6.4 feature 01 cost spine BACKEND complete + self-verified: ControlAccount + CostLine in costmodel; 7 additive linkage columns (boq.Position, procurement PO item + req item, contracts.ContractLine, rfq.cost_line_ids JSON, budget_line cost_line_id + control_account_id); migration v3151_cost_spine off v3150_file_favorites; CostSpineService (generate_from_boq idempotent fill-nulls + write-back onto positions + auto-link budget lines by boq_position_id; rollup_for_project/line; CRUD with 409 guards; link/unlink); 3 repos incl. CostSpineRepository's 4 one-query FX-aware grouped aggregates (budget; po filtered issued/partially_received/completed; contract Decimal->str coercion; claimed = max-cumulative per (cost_line, contract_line) summed, to avoid double-counting interim claims); 12 endpoints with verify_project_access -> 404 cross-tenant. Self-verified: create_all has all 7 cols, 16 /spine/ OpenAPI paths, alembic up/down/up roundtrip schema-equal both ways. Index-name deviation documented as non-colliding (create_all+pg_optimizations vs migration paths never coexist).

DONE this run: Cost-spine FRONTEND complete + verified: api.ts (6 spine methods + 9 TS interfaces, rollup money typed `string`), 4 components (CostSpinePanel grid with per-account subtotals + a mixed-currency banner that suppresses the blended total; ControlAccountTree; GenerateSpineButton; CostLineRollupDrawer), new Cost Spine section in FiveDDashboard (CostModelPage.tsx, dashboard sections end ~line 2363), 36 costmodel.spine.* keys in en.ts. tsc 0 errors, vitest 6/6, ESLint clean, no em-dashes. (Pre-existing em-dash at CostModelPage.tsx:1861 noted for the sweep.)

IN FLIGHT: Cost-spine TESTS (the LAST in-flight piece; the backend correctness gate): unit (exact Decimal asserts, idempotency, 409s, rollup+FX, mixed_currency) + integration (BOQ->budget->spine->PO->contract flow + IDOR 404) + roundtrip-list append + tests/pg (JSONB + grouped aggregates); runs on SQLite AND the PG lane; fixes root-cause bugs without weakening tests; reports every fix.

E2E TOOLING confirmed for the end-of-run full E2E: frontend/playwright.config.ts + e2e/ + tests/e2e/ + a smoke/ suite; package.json scripts test:e2e (playwright test), test:e2e:smoke, test:e2e:headed; @playwright/test + @axe-core/playwright installed. :8000 dev server alive (health: 6.3.1, 117 modules, database ok, frontend_dist_present; alembic_head_matches=false so status="degraded" - expected on the v6live dev DB, not a real problem). BEFORE E2E: rebuild frontend dist (cost-spine UI + guide text + CesiumLike fix) -> re-mirror to backend/app/_frontend_dist -> RESTART :8000 to load the cost-spine backend (kill ONLY the --port 8000 uvicorn python, keep postgres.exe so boot() reuses the cluster) -> confirm the v6live DB picked up the new costmodel tables via create_all on boot.

ENV NOTE: the Glob tool is unreliable in this session (uv_spawn errors and false "No files found" for files that exist) - use Bash `ls`/Grep for file-existence checks.

NEXT: review tests + frontend -> rebuild frontend dist + re-mirror to backend/app/_frontend_dist (picks up guide text + cost-spine UI + the CesiumLike fix) -> commit a clean milestone (NO tag) -> cross-module integration pass -> full E2E (real clicks, screenshots, logic) on :8000 covering geo + partner-packs + cost spine + a broad smoke -> bump 6.4.0 -> publish ONE release at the very end. Then if scope allows, the broad user-facing em-dash sweep TODO above.

TODO (later phase, do NOT start while costmodel/boq/procurement/contracts/rfq or ModuleDeveloperGuide.tsx/en.ts are being edited): broad user-facing em-dash sweep across the rest of the app (other backend modules' data string literals + all frontend locale files + components), since demo content alone held 489 - the codebase likely has more user-facing em-dashes elsewhere.

NEXT: review cost-spine backend -> launch its frontend + tests (PG-verified) -> then features 06/07/08 (write specs first, build sequentially to respect the linear alembic chain) -> cross-module integration pass -> full E2E (real clicks, screenshots, logic) -> bump 6.4.0 -> commit/tag/PyPI/GitHub/VPS. Maximal fidelity; complete each feature to standard; be transparent about completed vs deferred rather than half-building several.

DEV ENV: backend `:8000` = `python -m app.cli serve --data-dir C:/Users/Artem Boiko/.openestimate-v6live --port 8000` on embedded PostgreSQL (PID changes on restart; relaunched this run, not 16820). Frontend vite dev on `:5173`. Anaconda python: `/c/Users/Artem Boiko/anaconda3/python` (has pytest + the pip-installed package). Restart `:8000`: kill ONLY the uvicorn python (CommandLine matches `--port 8000`), leave `postgres.exe` alive so `boot()` reuses the cluster, then verify `/api/health` shows `database: ok`. Frontend changes: `npm run build` in `frontend/`, then robocopy `/MIR frontend/dist -> backend/app/_frontend_dist` (StaticFiles serves per-request; no restart for assets, but backend code changes DO need a restart).

## What we are building

The nine connective-tissue features from the competitive analysis (benchmarked against Nevaris, iTWO, Autodesk Construction Cloud, Procore). The theme: we already own the modules, the differentiated work is connecting them into one system of record, not adding more modules. Two facts from our own code prove it: `approval_routes` is a built generic approval engine that no module imports yet, and `contracts` already carries ProgressClaim / Schedule of Values / retention models that are not surfaced in any UI.

## Read these, in order

1. This file (state, constraints, dev environment).
2. `docs/strategy/IMPLEMENTATION_PLAN.md` (master plan: sequence, releases, per-feature step lists, alembic chain, consolidated test strategy, risks).
3. `docs/strategy/impl/NN-*.md` (deep design per feature, grounded in real code with cited file paths).
4. `docs/strategy/COMPETITIVE_FEATURE_ANALYSIS.md` (the why and the positioning).
5. `.claude/CLAUDE.md` (project identity and module conventions).

## Locked decisions (2026-06-01)

1. Execution order: dependency order. Cost spine (01) first, then the financial stack, the three independent features (06, 07, 08) in parallel, synthesis surfaces (09) last.
2. Release cadence: incremental. Shippable, browser-verified releases (v6.4, v6.5 and onward), grouped by dependency.
3. Depth per feature: maximal fidelity on the first pass. Each feature is built through all its phases to full standards-compliance before it is done. No MVP slice that defers the rest.
4. Region focus: region-neutral core plus partner packs. US AIA, DACH DIN, UK JCT behaviour layered through the partner-pack entry-point mechanism, never branched into core.

## Release grouping

| Release | Features | Full-fidelity effort |
|---------|----------|----------------------|
| v6.4 | 01 cost spine (keystone) + 06 submittals/RFI + 07 version compare + 08 field PWA (06/07/08 parallel, independent of 01) | 01:13d, 06:11d, 07:17d, 08:20d |
| v6.5 | 02 payment applications + 03 budget cockpit (both depend on 01 only, parallel) | 02:23d, 03:21d |
| v6.6 | 04 auto EVM + 05 5D cockpit | 04:19d, 05:18d |
| v6.7 | 09 AI assistant + controls dashboard, plus remaining depth | 09:22d |

Calendar time per release is the longest parallel lane plus its review and verification, not the sum.

## Dependency graph

```
01 cost spine (no deps, keystone)
  -> 02 pay apps, 03 budget cockpit, 05 5D cockpit (each needs 01 only)
       -> 04 auto EVM (needs 01 and 03)
            -> 09 AI + controls (needs 01, 03, 04)
independent from day one: 06 submittals/RFI, 07 version compare, 08 field PWA
```

## Alembic chain (assigned, linear, from plan section 6)

Four designs independently proposed `v3151`. The plan assigns one linear chain. Use the assigned id, not the design-doc placeholder. Verify `alembic heads` at build time, never hardcode against a stale head.

```
v3150_file_favorites            (current head, do not touch)
  -> v3151_cost_spine                  (01)
  -> v3152_doc_links                   (06 Phase 2)
  -> v3153_payment_applications        (02)
  -> v3154_drawing_version_compare     (07)
  -> v3155_budget_cockpit              (03)
  -> <next free id> auto_evm_init      (04)
  -> <next free id> field_pwa_sync     (08)
  -> <next free id> project_controls   (09)
```

If two features are in flight at once, the second to merge rebases its down_revision onto the first's head and renumbers so the chain stays linear. Every migration keeps the idempotent guard pattern from `v3150_file_favorites` (`_table_exists`, `_index_exists`, `_column_exists`), every column add carries a `server_default`, and every new model table is added to the pre-`create_all` import list in `app/main.py` (a fresh SQLite install runs `Base.metadata.create_all` before alembic).

## Hard constraints (non-negotiable)

- No em-dashes anywhere (UI strings, docs, commits, releases, issues). Hyphens, commas, periods only.
- No IfcOpenShell and no native IFC parsing. BIM and CAD data only through the DDC cad2data canonical format. BCF is allowed as an I/O format.
- Money: convert within a project via `fx_rates`; group by ISO currency code across projects; never blend mixed currencies into one scalar; keep a missing-rate amount in its own units and surface the code with a mixed_currency flag; Decimal in, Decimal-as-string out; reuse the shared `_amount_in_base` / `_portfolio_money_breakdown` helpers, never invent FX math.
- No stubs or placeholders. Every shipped slice is a real working vertical: a control with no backend, a hard-coded zero, or a flag-gated empty feature is a failed phase.
- IDOR: every endpoint resolves the owning project and calls `verify_project_access` (field PWA reads project_id from the pinned session); return 404, never 403, on a cross-tenant miss.
- Event subscribers are idempotent against re-delivery, open their own `async_session_factory` session, and swallow failures so they never roll back the upstream transaction.
- Module conventions (`.claude/CLAUDE.md`): models, schemas, repository, service, router, tests. Permissions registered on startup. Router auto-mounted at `/api/v1/{module}/`.
- GitHub text and commits: DataDrivenConstruction voice, human prose, few lists, no AI or Claude attribution, no em-dashes. Commit and push only when the founder asks. Push by explicit SHA refspec `$(git rev-parse HEAD):refs/heads/main`, verify with `git ls-remote`.
- Frontend: `npx tsc --noEmit` clean (strict mode on); co-located vitest; new user-facing strings via i18n translated into all 26 non-English locales (i18n-sweep skill).
- Email: only `info@datadrivenconstruction.io`.

## How to build one feature

1. Read its `docs/strategy/impl/NN-*.md` design.
2. Backend: models, then migration (assigned id, idempotent guards, server defaults, add table to `app/main.py` pre-create_all import), then schemas, repository, service, router (RBAC + `verify_project_access`), permissions on startup.
3. Backend tests: per-module temp SQLite set before any `from app...` import; exact Decimal asserts on money; an IDOR-404 case; alembic round-trip added to `tests/integration/test_migrations_roundtrip.py`.
4. Frontend: feature folder, api client, components, route and sidebar wiring (`ROUTE_MODULE_KEY` then `isModuleEnabled`).
5. Frontend vitest plus `tsc --noEmit` clean.
6. Browser verify on :8000, sequentially (never parallel against a shared server), including a `?lang=de` pass that leaks no raw i18n keys.
7. Adversarial review against the design and these constraints before the feature is called done.

## Dev environment

- :8000 dev server (founder tests here): anaconda python `-m app.cli serve --data-dir "C:/Users/Artem Boiko/.openestimate-v6live" --port 8000`. Embedded PostgreSQL, serves the built bundle in `backend/app/_frontend_dist` (not the vite source), no `--reload` so a backend code change needs a restart. Health at `/api/health` (reports version, module count, `alembic_head_matches`).
- Backend tests: anaconda python `"/c/Users/Artem Boiko/anaconda3/python" -m pytest <file>` run from `backend/`. Run each integration test file in its own process (the per-module temp-sqlite env is set at import, so two integration files in one process collide).
- Frontend build: `cd frontend && npm run build`, then mirror `frontend/dist` into `backend/app/_frontend_dist` (robocopy /MIR, keep `_frontend_dist_prev`), then restart :8000.
- ruff: 0.15.14, line-length 120, select E,F,W,I,N,UP,ANN,B,A,COM,C4,PT,RET,SIM,ARG. Ruff-check only the files you changed, the wider tree has pre-existing lint.
- VPS deploy: by tag, mirror the prebuilt dist, restart the `openconstructionerp` systemd unit. Never build the frontend on the VPS (disk near full). App listens on port 9090 behind Caddy. Use the 4-slash absolute `DATABASE_SYNC_URL` for alembic on the VPS.

## Status board

Base: v6.3.1 (geo crash fix + 3D geometry, schedule-summary and AI-insights widget endpoints, real multi-year calendars, removed coming-soon teasers, real Daily Diary PDF, match_elements PDF source + LLM matcher + split/merge + RFQ wire-up, partner-pack activate installs catalog + resources with a streamed progress bar, Jehad's takeoff/Docker/nginx fixes). Status: in final verification, not yet committed or published.

| ID | Feature | Release | Status | Branch/worktree | Notes |
|----|---------|---------|--------|------------------|-------|
| - | v6.3.1 base | - | in verification | main (uncommitted) | tsc + vitest green; backend tests running |
| 01 | Cost spine | v6.4 | not started | - | keystone, build first and verify before 02/03/05 |
| 06 | Submittals/RFI via approval_routes | v6.4 | not started | - | independent, mostly activation |
| 07 | Drawing version compare | v6.4 | not started | - | independent |
| 08 | Field PWA | v6.4 | not started | - | independent |
| 02 | Payment applications | v6.5 | not started | - | needs 01 |
| 03 | Budget cockpit | v6.5 | not started | - | needs 01 |
| 04 | Auto EVM | v6.6 | not started | - | needs 01, 03; extracts shared app/core/evm.py |
| 05 | 5D cockpit | v6.6 | not started | - | needs 01 |
| 09 | AI assistant + controls dashboard | v6.7 | not started | - | needs 01, 03, 04 |

## Progress log

- 2026-06-01: Competitive analysis, master implementation plan, and nine deep design docs written. Four decisions locked (dependency order, incremental releases, maximal fidelity, region-neutral plus packs). v6.3.1 in final verification as the clean base. Build of v6.4 starts on the committed v6.3.1 base, keystone 01 first.

## Next concrete action

1. Finish v6.3.1 verification (await backend test run), build the frontend, mirror dist, browser-verify on :8000.
2. Bump 6.3.0 to 6.3.1 in `backend/pyproject.toml` and `frontend/package.json` (and Changelog), commit in DataDrivenConstruction voice, push by SHA refspec, tag `v6.3.1` (triggers PyPI and GitHub release), deploy to VPS by tag.
3. On the committed v6.3.1 base, launch the v6.4 build: feature 01 (cost spine) carefully and verified first, with features 06, 07, 08 in parallel worktrees. Update the Status board and Progress log as each lane lands.
