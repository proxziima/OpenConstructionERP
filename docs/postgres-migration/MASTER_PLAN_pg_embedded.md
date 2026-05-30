# MASTER PLAN — Postgres Everywhere via Embedded Postgres (no Docker)

> **THIS IS THE SINGLE SOURCE OF TRUTH FOR THE POSTGRES MIGRATION.**
> It is written to be resumable: if work pauses, read the "HOW TO RESUME" block,
> then the "PROGRESS LOG" at the bottom (newest entry last), then jump to the
> first phase whose status is not ✅ DONE. Update the status markers and append a
> PROGRESS LOG entry every time you do work here.

Decision owner: DataDrivenConstruction (Artem). Plan created 2026-05-30.

---

## HOW TO RESUME (read this first after any pause)

1. Confirm git ground truth (one consistent read — do not trust stale memory):
   - `git -C "<repo>" log --oneline -5`
   - `git -C "<repo>" rev-parse HEAD` and `git ls-remote origin refs/heads/main`
   - `git -C "<repo>" rev-list --left-right --count origin/main...HEAD` (behind/ahead)
   - on-disk version: `grep -m1 '^version' backend/pyproject.toml`
2. Read the PROGRESS LOG at the bottom of this file (last entry = where we stopped).
3. Find the first phase below whose status header is not `✅ DONE`. That is the
   resume point. Its "Steps" are checklists; the first unchecked `[ ]` is next.
4. Re-verify any environmental claim before acting (harness reads can be stale;
   `docker` is NOT on this shell's PATH; on this Windows box use `python`, not
   `python3`).

### Repo / environment facts (authoritative)
- Repo root: `C:/Users/Artem Boiko/Desktop/CodeProjects/ERP_26030500`
- Default branch: `main`. Git user: DataDrivenConstruction.
- Backend: FastAPI + SQLAlchemy 2.0 async, Python 3.12. ~205k LOC in `backend/app/`.
  433 tables, 117 modules.
- Tests: `backend/tests/`, conftest uses `sqlite+aiosqlite:///:memory:`
  (`tests/conftest.py:84-86`). ~38 test files reference sqlite.
- On THIS box: `python` works, `python3` is the broken MS-Store stub. `docker` is
  NOT installed on the Bash shell PATH (do not assume docker for local work).
- Local data dir: `~/.openestimate/` (note: cli.py uses `~/.openestimate`,
  config.py default uses `~/.openestimator` — PRE-EXISTING inconsistency, flagged,
  do not "fix" casually; reconcile deliberately in Phase 3).

### Release / CI facts
- Version files (must stay in sync; CI `version-sync` gate via
  `scripts/check_version_sync.py`): `backend/pyproject.toml` (source of truth,
  `version = "X.Y.Z"`), `frontend/package.json`, `CHANGELOG.md` (top `## [X.Y.Z]`),
  `frontend/src/features/about/Changelog.tsx` (top `version: 'X.Y.Z'`, flat array
  `{version,date,tag?,summary}`).
- Publish: push tag `v*` → `pypi-publish.yml` (Trusted Publishing, OIDC, env `pypi`,
  no token) builds frontend then wheel from `backend/` → PyPI. Same tag also fires
  `release.yml` (GHCR + GitHub Release) and `desktop-release.yml` (Tauri) — **both
  have been FAILING for several releases (pre-existing infra debt), they do NOT block
  pip**. `ci.yml` runs version-sync + lint/test on push to main/PRs.
- Current released version: **5.9.2** (PyPI confirmed live, de-branded). main at
  commit that bumped 5.9.2.
- Push protocol: `git push origin <SHA>:refs/heads/main`; verify with
  `git ls-remote origin refs/heads/main` (plain `git push` can silently no-op).

### VPS facts (production demo openconstructionerp.com, 24/7)
- Host `root@31.97.123.81`. Repo `/root/OpenConstructionERP`. venv
  `/root/OpenConstructionERP/venv/` (NOT .venv). systemd unit `openconstructionerp`,
  serves port 9090. Current DB `/root/OpenConstructionERP/data/openestimate.db`
  (SQLite). Serves frontend from `backend/app/_frontend_dist` (sync after pip install).
- Health: `/api/health` (NOT `/api/v1/health`). Expect `database=ok`,
  `alembic_head_matches=true`.
- VPS also runs OTHER docker stacks (n8n; conference-chat = caddy/nocodb/qdrant/2×
  postgres; dokufluss) on their own ports incl 5432 — **NEVER touch/prune/reuse them**.
- Disk tight (~95% root). Only docker build cache + dangling volumes safely
  reclaimable. Embedded PG `pgdata` will live under
  `/root/OpenConstructionERP/data/pgdata`.
- Demo login: `demo@openconstructionerp.com`. (Historic `demo@openestimator.io`
  removed.) Contact email: only `info@datadrivenconstruction.io`.
- alembic on VPS for SQLite needs 4-slash abs `DATABASE_SYNC_URL` (`sqlite:////root/...`).

---

## THE DECISION (locked 2026-05-30)

**Destination: Postgres-only. SQLite removed entirely.**
**Default delivery: an EMBEDDED Postgres the app starts/stops itself. The user does
nothing. NO Docker on the happy path — Docker is an optional extra only, never required.**

Founder choices (via AskUserQuestion):
1. **Existing SQLite data → transparent auto-migration** on first PG launch
   (migrate, verify counts, archive `.bak`, abort-to-SQLite on failure).
2. **VPS production → embedded PG too** (not a separate DB container).
3. **Staged rollout; SQLite removal is the FINAL flip (v6.0.0).** Each stage ships
   and is verified independently; SQLite stays as the safety net until the embedded
   path is proven.
4. **No Docker as platform** (re-confirmed): embedded PG is the main path everywhere
   incl VPS; Docker only for those who explicitly want it.

### Why (measured by workflow wf_f52a4ce2, 6 agents — see `_inv_*.md`, `_DECISION_*.md`)
Dropping SQLite deletes **~1000+ LOC of dual-dialect tax** plus an entire recurring
bug class. Concrete removals quantified in Phase 5. The chief one-time cost is moving
the test suite onto a real Postgres in CI (Phase 1 solves this WITHOUT Docker by
reusing the same bundled pgserver).

### Engine: `pixeltable-pgserver`
- License: Apache-2.0 wrapper; bundled PostgreSQL under the liberal PostgreSQL License.
  Both AGPL-3.0 compatible. (Add bundled-binary license to `NOTICE.backend.json`.)
- Ships real **PG16** binaries in **~10-13 MB** wheels for linux/macOS/**Windows incl
  arm64**; Python 3.10-3.14; active (0.5.1, Jan 2026). **PIN a current 0.5.x**
  (0.2.0/0.2.1 are YANKED — never use).
- API seam:
  ```python
  import pgserver
  srv = pgserver.get_server(pgdata_path)   # runs initdb on first call
  uri = srv.get_uri()                      # unix socket (linux/mac) | TCP loopback (Windows)
  # ... derive async (postgresql+asyncpg://) and sync (postgresql+psycopg2://) URLs
  srv.cleanup()                            # stop; ref-counted across processes
  ```
- Already present to receive it: `asyncpg` + `psycopg2-binary` declared (in `[server]`
  extra, `backend/pyproject.toml:85-86`); engine already dialect-branches
  (`database.py:194` `_is_sqlite`); `app/scripts/migrate_sqlite_to_postgres.py` ready;
  JSON→JSONB DDL hook wired (`database.py:235-244` → `core/pg_optimizations.py`).
- Risks (carried into phases): single-maintainer dep (bus factor); Windows TCP-port
  clash + stale `postmaster.pid`; PG-major (16→N) upgrade ownership; idle RAM on the
  2 GB VPS; refuses to run PG as root (spawns non-root).

---

## PHASES (status: ✅ DONE · 🔵 IN PROGRESS · ⬜ TODO · 🚫 BLOCKED)

Dependency chain: P0 → P1 → P2 → P3 → P4 → P5 → P6.
Task IDs in the session task list: P1=#7, P2=#8, P3=#9, P4=#5, P5=#10.

---

### Phase 0 — Foundation — ✅ DONE (shipped in v5.9.2)
Goal: PG plumbing in place, zero user-facing change.

Steps:
- [x] JSON→JSONB `@compiles` on PG dialect only — `core/pg_optimizations.py`.
- [x] Auto perf indexes (FK btree, composite `(project_id,created_at)`/`(...,status)`,
      GIN on `asset_info`/`classification`) via `after_create` event; names hashed to
      PG 63-byte limit; GIN skipped on non-PG.
- [x] Pool hardening: `pool_pre_ping`+`pool_recycle` (PG only), pool size/overflow both.
- [x] `app/scripts/migrate_sqlite_to_postgres.py` (streams all 433 tables, sequence
      reset, `--truncate`/`--dry-run`/`--batch-size`; NO `--only`/`--skip-create`).
- [x] Drivers `asyncpg>=0.30.0` + `psycopg2-binary>=2.9.10` declared.
- [x] CWICR bulk import dialect-aware (SQLite raw fast path kept; PG → psycopg2
      `ON CONFLICT (code,region) DO NOTHING`) — `modules/costs/router.py`.
- [x] feedback endpoint DDL dialect-branched; `json_path_text` helper (`core/sql_json.py`).
- [x] Released as 5.9.2 (PyPI live, de-branded).

Verification on record: `_pgverify.py` passed earlier (433 tables, JSONB only on PG,
1403 indexes); `_pg_code_review.md` = **0 blockers, 3 HIGH** (the 3 HIGH are folded
into Phase 2/3 below); `_models_alembic_assessment.md` = models 0 PG breakers, alembic
0 reachable on fresh PG.

---

### Phase 1 — PG CI lane (no user-facing change) — ⬜ TODO  [task #7]
Goal: STOP shipping untested PG code. Today tests run only on in-memory SQLite, so
every PG-only arm (FTS `to_tsvector`, JSONB `@>`, `if dialect=='postgresql'` branches)
is unverified.

Steps:
- [ ] Add a pytest fixture that, when `OE_TEST_DB=pg`, spins an ephemeral
      `pixeltable-pgserver` cluster in a tmp dir for the test session, exposes its URI,
      and tears it down at session end. (No external service container, no Docker.)
      Per-test isolation via transaction-rollback (SAVEPOINT) like the current sqlite
      fixture. Touch: `backend/tests/conftest.py` (currently `:84-86`).
- [ ] Add a CI job in `.github/workflows/ci.yml` (or a new `ci-pg.yml`) that installs
      `pixeltable-pgserver` and runs the full suite with `OE_TEST_DB=pg`. Keep the
      existing SQLite lane in parallel (dual green).
- [ ] Make the test bootstrap build schema via `Base.metadata.create_all` (fires the
      JSONB+index events) — NOT the alembic chain.
- [ ] Triage failures into the Phase 2 fix list (do not fix here unless trivial).
- [ ] Add `pixeltable-pgserver` to dev/test deps (a `[test]` or `[dev]` extra), pinned.

Gate: full suite green on BOTH backends; PG lane runs in CI on every push.
Output the real PG failure list to `docs/postgres-migration/_phase1_pg_failures.md`.

---

### Phase 2 — PG-correctness fixes — 🚫 BLOCKED by P1  [task #8]
Goal: the app is byte-for-byte correct on Postgres.

Steps:
- [ ] **`.like()` → `.ilike()` audit.** 95 `.like(` vs 47 `.ilike(` sites. SQLite LIKE
      is case-insensitive; PG LIKE is case-sensitive. Convert every case-insensitive-
      intent `.like` to `.ilike`. (grep `\.like\(` across backend/app; judge each.)
- [ ] **JSONB-containment vs LIKE-scan forks** — make PG `@>`/`#>>` correct & primary:
      `tasks/service.py:50-66`, `bim_hub/service.py:180-185`, `boq/events.py:87-93`,
      `costs/repository.py:44-48`.
- [ ] **3 HIGH from `_pg_code_review.md`:**
  - [ ] migrate `--truncate` → `TRUNCATE ... CASCADE` or deferred FK
        (`SET session_replication_role = replica`), because cyclic & self-referential
        FKs (hierarchical BOQ positions) raise `ForeignKeyViolation` on PG.
  - [ ] GIN indexes → `postgresql_using='gin'` with `jsonb_path_ops` opclass (not
        default `jsonb_ops`) for the containment workload — `core/pg_optimizations.py:127-134`.
  - [ ] Pool sizing → deliberate per-dialect (PG pool ≠ SQLite) — `database.py:214-226`.
- [ ] Confirm `migrate_sqlite_to_postgres.py` handles BLOB/NULL/bool(0/1→bool)/
      datetime(text→timestamptz)/JSON-text→JSONB and inserts respecting FK order or
      with FK deferral.

Gate: PG lane green with ZERO dialect-skips; manual sequential probe of FTS + JSONB
endpoints on a real PG. (Local PG for probing: use a `pixeltable-pgserver` scratch
cluster from a `python` one-liner — no Docker.)

---

### Phase 3 — Embedded PG opt-in + lifecycle hardening — 🚫 BLOCKED by P2  [task #9]
Goal: `serve --embedded-pg` is flawless on win/mac/linux BEFORE it becomes default.

Steps:
- [ ] Add extra `openconstructionerp[embedded-pg]` → `pixeltable-pgserver` (pin 0.5.x)
      in `backend/pyproject.toml`.
- [ ] `backend/app/cli.py`: new bootstrap in `_setup_env`/`cmd_serve`/`init-db`/
      `doctor`/`seed`. Before the current SQLite `setdefault` (`cli.py:185-188`):
      start managed cluster under `<data-dir>/pgdata`, derive async
      (`postgresql+asyncpg://…`) + sync (`postgresql+psycopg2://…`) URLs from
      `srv.get_uri()`, `os.environ.setdefault` them, run `alembic upgrade head`
      (or `create_all`+`stamp head` on fresh), serve; `srv.cleanup()` on shutdown.
- [ ] **Reconcile the data-dir inconsistency** (`~/.openestimate` vs `~/.openestimator`)
      deliberately here — pick one, migrate the other, document.
- [ ] **Lifecycle hardening (the real risk surface):**
  - [ ] Stale lock recovery: detect `<pgdata>/postmaster.pid`, check PID liveness; if
        dead, clear and restart (Windows force-close / OOM / power-loss leaves locks).
  - [ ] Windows loopback TCP port auto-retry across a range + clear error (mirror the
        existing HTTP `check_port_free`).
  - [ ] PG-major version sentinel file in pgdata; on future 16→17/18, auto
        dump→fresh-initdb→restore (reuse migrate/restore primitives). Own this now.
  - [ ] Non-root on VPS/Linux (pgserver refuses root; spawns non-root) — verify;
        or run systemd unit as a dedicated user.
  - [ ] Tuned-small defaults (`shared_buffers`, `max_connections`) for the 2 GB VPS.
- [ ] `doctor` reports embedded-PG health (cluster up, port, data dir, PG version).

Gate: clean first-run + restart + simulated-crash-recovery on all 3 OSes; idle RAM
measured under the 2 GB budget. Document results in
`docs/postgres-migration/_phase3_embedded_results.md`.

---

### Phase 4 — Flip default to embedded PG (v6.0.0) + transparent auto-migration — 🚫 BLOCKED by P3  [task #5]
Goal: every user, incl the VPS, runs on Postgres with zero manual steps.

Steps:
- [ ] Make embedded PG the **default** (no flag needed). SQLite still selectable via
      explicit `DATABASE_URL=sqlite://…` as the rollback hatch (removed in Phase 5).
- [ ] **Transparent auto-migration on first PG launch (idempotent, safe order):**
  1. [ ] If `<data-dir>/openestimate.db` exists AND embedded `pgdata` is fresh/empty →
  2. [ ] start embedded PG, `create_all` (fires JSONB+index events) →
  3. [ ] run `migrate_sqlite_to_postgres` (stream all tables, reset sequences) →
  4. [ ] verify per-table row counts == SQLite source →
  5. [ ] write `<data-dir>/migrated.json` sentinel + archive SQLite as `*.bak-<ts>` →
  6. [ ] on ANY failure: abort to SQLite, leave source untouched, clear error.
        NEVER destroy the source until verification passes.
- [ ] Bump versions to 6.0.0 in all 4 files; CHANGELOG + Changelog.tsx entries.
- [ ] **VPS cutover (no Docker):** systemd unit boots app → app boots embedded PG under
      `/root/OpenConstructionERP/data/pgdata`; auto-migrate the live SQLite once; verify
      `/api/health` `database=ok` + counts. Other VPS stacks untouched. Sequential
      smoke only (never parallel probes against the shared VPS).
- [ ] Tag `v6.0.0`; confirm PyPI publish; sync `_frontend_dist` on VPS after deploy.

Gate: fresh install, upgrade-with-data, AND VPS all serve on PG; demo seed intact;
`/api/health` green. Document in `docs/postgres-migration/_phase4_cutover_results.md`.

---

### Phase 5 — Remove SQLite, delete the dual-dialect tax — 🚫 BLOCKED by P4  [task #10]
Goal: one engine, one code path. ~1000+ LOC gone. (Exact targets from `_inv_simplification.md`.)

Steps:
- [ ] Delete in full: `core/sql_json.py` (80 LOC) + `tests/unit/test_sql_json.py` (210);
      `middleware/sqlite_retry.py` (79) + its test (118). Remove their registrations.
- [ ] `database.py`: `GUID` → native `postgresql.UUID(as_uuid=True)` (**803 `GUID()`
      call sites across 102 model files** — mechanical); drop `_tolerant_json_loads`
      (`:165-180`), the SQLite PRAGMA connect listener (`:198-206`), the `_is_sqlite`
      pool branch; make `pool_pre_ping`/`pool_recycle` unconditional.
- [ ] `core/db_types.py`: `MoneyType`/`SafeDate` → thin `Numeric`/`Date` (drop SQLite
      string-storage branches — also fixes the lexical-money-sort footgun). 6 files /
      57 call sites.
- [ ] `core/pg_optimizations.py`: models declare `JSONB` natively; the `@compiles`
      trick + runtime index-inference move to declarative model/migration indexes.
- [ ] Remove SQLite arm in runtime forks: `tasks`, `bim_hub`, `boq/events`,
      `costs`×2, `file_search`, `property_dev`.
- [ ] Drop `aiosqlite` dep; tests become **PG-only** (single lane); delete SQLite CI lane.
- [ ] New migrations: no more `batch_alter_table`/boolean/UUID dialect forks (the
      ~150-site ongoing tax ends). Historical migrations stay inert (fresh PG uses
      create_all+stamp).

Gate: full suite green PG-only; grep proves ZERO `sqlite`/`_is_sqlite`/`json_extract`
in runtime `app/`; clean install + upgrade-with-data still pass. Tag a minor release.

---

### Phase 6 — Now-unlocked scale work — ⬜ TODO (deferred, separate efforts)
With PG universal: Redis caching, Celery offload, multi-tenant RLS. Each its own plan.
(Existing session task #6.)

---

## RISK REGISTER (carried)

| Risk | Mitigation / where |
|------|--------------------|
| Single-maintainer embedded-PG dep (bus factor) | Phase 3 pin 0.5.x; Phase 1 CI exercises it every run; SQLite stays as hatch until Phase 5 |
| Windows stale `postmaster.pid` / TCP port clash | Phase 3 lifecycle hardening |
| PG 16→N major upgrade strands data | Phase 3 version sentinel + dump/restore fallback |
| Tests need real PG (CI time / dev loop) | Phase 1 — reuse the bundled pgserver, no external service / no Docker |
| Data loss on auto-migrate | Phase 4 — verify-before-archive, abort-to-SQLite on failure |
| VPS embedded PG as root / 2 GB RAM | Phase 3 non-root + tuned-small defaults; Phase 4 VPS gate |
| Desktop (Tauri) sidecar | embedded PG is the same answer; validated in Phase 3 cross-OS gate |
| Other VPS stacks (n8n/conf-chat/dokufluss) | NEVER touch; embedded pgdata is self-contained under our repo data dir |

## EXPLICITLY NOT DOING
- Not requiring Docker on the happy path (Docker = optional extra only).
- Not rewriting 198 historical migrations (inert on fresh PG; new ones are clean).
- Not making the VPS depend on a separate DB container.

## SUPPORTING DOCS (in this folder)
- `_DECISION_sqlite_vs_pgonly.md` — the decision memo (3 strategies, recommendation).
- `_inv_embedded_pg.md` — embedded-PG package comparison + viability verdict.
- `_inv_simplification.md` — exact LOC/constructs removable (Phase 5 targets).
- `_inv_coupling.md` / `_inv_test_ci.md` / `_inv_onboarding.md` — supporting inventories.
- `_pg_code_review.md` — 0 blockers / 3 HIGH (folded into P2/P3).
- `_models_alembic_assessment.md` — models 0 breakers / alembic 0 reachable.
- `_vps_cutover_plan.md` — earlier container-based VPS plan (SUPERSEDED by embedded;
  keep for the migrate-script CLI flags + env-var names reference).

---

## PROGRESS LOG (append newest at the bottom; one entry per work session)

### 2026-05-30 — Plan created, P0 shipped
- Phase 0 complete and released as **v5.9.2** (PyPI live + de-branded; main pushed;
  tag v5.9.2). PG foundation in place. release.yml/desktop-release.yml failing is
  PRE-EXISTING (not a 5.9.2 regression); pip path unaffected.
- Direction LOCKED with founder: embedded Postgres everywhere, no Docker, SQLite
  removed, transparent auto-migration, embedded on VPS too, staged rollout (SQLite
  removal = final flip v6.0.0).
- Engine chosen: `pixeltable-pgserver` (Apache-2.0, PG16, ~10-13 MB, win/mac/linux,
  pin 0.5.x). Investigations done via workflow wf_f52a4ce2 (6 agents).
- Tasks created and chained: P1 #7 → P2 #8 → P3 #9 → P4 #5 → P5 #10. P6 = #6.
- **NEXT ACTION:** start Phase 1 — add the `pixeltable-pgserver`-backed PG test
  fixture in `backend/tests/conftest.py` + a PG CI lane, keeping the SQLite lane green.
  (Local note: `docker` not needed; `python` not `python3` on this box.)


---

### PROGRESS 2026-05-30 (Phase 1 - PG CI lane) - DONE

Embedded PostgreSQL confirmed working end-to-end on this box, NO Docker.

Engine: pixeltable-pgserver 0.5.1 (bundled PostgreSQL 16). GOTCHA that cost
time: the import name is **pixeltable_pgserver**, NOT pgserver (renamed from the
0.2.x line; top_level.txt = _postgresql + pixeltable_pgserver). On Windows
get_uri() returns a TCP URL (postgresql://postgres:@127.0.0.1:<rand>/postgres);
on Linux it is a unix-socket URL. Portable handling: make_url(srv.get_uri())
.set(drivername="postgresql+asyncpg" | "postgresql+psycopg2") - never hand-parse.

Schema smoke gate PASSED (fresh, verified this session): the full ORM schema
builds on a real embedded PG cluster - 117 modules discovered, 96 model modules
imported, **434 tables, 494 JSONB columns, 1948 indexes, 5 GIN**. Proves the
JSON->JSONB @compiles hook and the after_create index events fire, and that
there are no jsonb[]/dialect DDL breakers (assemblies/models.py is plain JSON in
this HEAD - the historical ARRAY(JSON) concern is not present).

REAL BUG the PG lane caught (and fixed): app/database.py registered the SQLite
WAL/foreign_keys PRAGMA listener on the **Engine base class**, so it fired for
EVERY engine in the process - including a PostgreSQL engine created after the
SQLite one -> "syntax error at or near PRAGMA". Fixed by gating the listener on
the connection's DBAPI module ("sqlite" in type(dbapi_conn).__module__). This
also hardens the real embedded-PG runtime (Phase 3/4).

Deliverables shipped:
* backend/tests/pg/ - dedicated PG dialect suite (conftest boots embedded PG
  once via pixeltable_pgserver, builds the schema once with a sync engine,
  per-test savepoint isolation; gated to skip unless OE_TEST_DB=pg).
  test_pg_dialect.py: full-schema-builds, JSONB round-trip + @> containment,
  ILIKE-vs-LIKE case sensitivity, native uuid round-trip. 4/4 GREEN on PG;
  correctly SKIPPED on the default SQLite lane.
* .github/workflows/ci-postgres.yml - CI job (ubuntu-latest, OE_TEST_DB=pg,
  pip install -e .[dev,server], pytest tests/pg). No service container -
  pgserver is embedded.
* backend/app/database.py - PRAGMA-listener dialect guard (above).
* backend/pyproject.toml - pixeltable-pgserver>=0.5.1,<0.6 added to the dev
  extra (asyncpg + psycopg2-binary already in server extra).
* conftest.py - WindowsSelectorEventLoopPolicy (asyncpg ProactorEventLoop emits
  'Event loop is closed' at teardown on Windows).

SCOPE NOTE (important, honest): the legacy suite is NOT ported to PG. The
architecture is 149 test files that each build their OWN engine with a
HARD-CODED sqlite+aiosqlite:///<tempfile> URL (not from env) + per-file
create_all + StaticPool/check_same_thread. Neither an env flip nor a single
shared-fixture patch can redirect them, and pristine-per-test isolation on a
shared PG needs a template-database clone-per-test harness. That is the
Phase-2 stretch: monkeypatch create_async_engine in the root conftest under
OE_TEST_DB=pg to (a) drop sqlite-only connect_args, (b) StaticPool->NullPool,
(c) CREATE DATABASE <uniq> TEMPLATE <schema-built-once> and rewrite the URL.
Designed, not yet built.

PRE-EXISTING (not PG, not mine): tests/unit/test_assemblies.py emits 13 errors
on the SQLite lane on this box - "index ix_oe_bim_model_project_id_status
already exists" during a create_all re-run. Logged for a separate test-infra
fix; unrelated to the PG migration.

NEXT: Phase 2 - PG-correctness sweep (.like->.ilike audit, JSONB query forks,
the 3 HIGH items from the code review), validated by extending tests/pg.
