"""Optional embedded PostgreSQL runtime — a real PG16 in-process, no Docker.

Boots a PostgreSQL 16 cluster from the ``pixeltable-pgserver`` wheel (bundled PG
binaries) and points the app's ``DATABASE_URL`` / ``DATABASE_SYNC_URL`` at it, so
the whole app runs on PostgreSQL with zero external setup. Opt-in only:

* ``openconstructionerp serve --embedded-pg``  (sets ``OE_USE_EMBEDDED_PG=1``), or
* ``OE_USE_EMBEDDED_PG=1`` in the environment (honoured by every CLI command).

The cluster's data directory is ``<data_dir>/pgdata`` so it survives restarts.
On first boot ``initdb`` runs once (a few seconds); subsequent boots attach to the
existing cluster.

Ordering contract
~~~~~~~~~~~~~~~~~
``app.database`` builds the SQLAlchemy engine from ``settings.database_url`` at
*import time*. :func:`boot` therefore MUST run before the first ``from app...``
import that pulls in ``app.database`` (and before ``get_settings()`` is cached).
The CLI calls it from ``_setup_env``, which every command runs before importing
any app module — so the contract holds for ``serve``/``init-db``/``seed``.

Single-process only: run ONE uvicorn worker with embedded PG (the default). For
multi-worker deployments use an external PostgreSQL and set ``DATABASE_URL``
directly.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

#: Module-level handle to the running server, kept so :func:`shutdown` can stop it.
_server = None

_TRUTHY = {"1", "true", "yes", "on"}


def is_requested() -> bool:
    """True when embedded PostgreSQL was requested (flag or env)."""
    return os.environ.get("OE_USE_EMBEDDED_PG", "").strip().lower() in _TRUTHY


def is_running() -> bool:
    """True once :func:`boot` has successfully started a cluster this process."""
    return _server is not None


def boot(data_dir: Path | str) -> bool:
    """Boot embedded PostgreSQL and point DATABASE_URL/DATABASE_SYNC_URL at it.

    Idempotent (a second call is a no-op once running). Never raises: on any
    failure it logs and returns ``False``, leaving the existing (SQLite) URLs in
    place so the app can still come up. Returns ``True`` on success.
    """
    global _server
    if _server is not None:
        return True

    try:
        import pixeltable_pgserver as pgserver
        from sqlalchemy.engine import make_url
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "embedded PostgreSQL requested but pixeltable-pgserver is not installed "
            "(pip install 'openconstructionerp[server]' or pixeltable-pgserver): %r",
            exc,
        )
        return False

    pgdata = Path(data_dir).expanduser() / "pgdata"
    try:
        pgdata.mkdir(parents=True, exist_ok=True)
        srv = pgserver.get_server(str(pgdata))
    except Exception as exc:  # noqa: BLE001
        logger.error("embedded PostgreSQL failed to start at %s: %r", pgdata, exc)
        return False

    try:
        # get_uri() is portable: TCP loopback on Windows, a unix socket on
        # Linux/macOS. Swap only the SQLAlchemy driver — never hand-parse it.
        base = make_url(srv.get_uri())
        async_url = base.set(drivername="postgresql+asyncpg")
        sync_url = base.set(drivername="postgresql+psycopg2")
        os.environ["DATABASE_URL"] = async_url.render_as_string(hide_password=False)
        os.environ["DATABASE_SYNC_URL"] = sync_url.render_as_string(hide_password=False)
    except Exception as exc:  # noqa: BLE001
        logger.error("embedded PostgreSQL booted but URL wiring failed: %r", exc)
        try:
            srv.cleanup()
        except Exception:  # noqa: BLE001
            pass
        return False

    _server = srv
    logger.info("embedded PostgreSQL ready (data dir: %s)", pgdata)
    return True


def shutdown() -> None:
    """Stop the embedded cluster if this process booted one (safe to always call)."""
    global _server
    if _server is None:
        return
    try:
        _server.cleanup()
        logger.info("embedded PostgreSQL stopped")
    except Exception:  # noqa: BLE001
        logger.debug("embedded PostgreSQL cleanup failed", exc_info=True)
    finally:
        _server = None
