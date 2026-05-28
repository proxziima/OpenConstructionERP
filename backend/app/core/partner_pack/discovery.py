"""Discover partner packs installed alongside the core via pip.

A partner pack registers via the entry-point group
``openconstructionerp.partner_packs``::

    [project.entry-points."openconstructionerp.partner_packs"]
    batimatech-ca = "openconstructionerp_batimatech_ca:MANIFEST"

The value must point at a module-level attribute that is either:
  * a ``PartnerPackManifest`` instance, OR
  * a ``dict`` the loader coerces into one.

At boot, ``discover_packs()`` enumerates all entries. ``get_active_pack()``
picks one based on the precedence:

  1. env var ``OE_PARTNER_PACK`` (matches manifest.slug)
  2. the first registered entry (alphabetical by slug)
  3. None  — the platform runs in vanilla OCERP mode
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from importlib import import_module
from importlib.metadata import EntryPoint, entry_points

from app.core.partner_pack.manifest import PartnerPackManifest

logger = logging.getLogger(__name__)

ENTRY_POINT_GROUP = "openconstructionerp.partner_packs"


def _coerce_manifest(value: object) -> PartnerPackManifest:
    """Accept either a manifest instance or a dict and return a manifest."""
    if isinstance(value, PartnerPackManifest):
        return value
    if isinstance(value, dict):
        return PartnerPackManifest(**value)
    raise TypeError(
        f"Partner pack entry-point must point at a PartnerPackManifest or dict, "
        f"got {type(value).__name__}"
    )


def _load_one(ep: EntryPoint) -> PartnerPackManifest | None:
    """Resolve a single entry-point into a manifest, logging failures."""
    try:
        target = ep.load()
        return _coerce_manifest(target)
    except Exception as exc:  # noqa: BLE001 — boot-time best-effort
        logger.warning(
            "Partner pack '%s' failed to load: %s. Skipping.",
            ep.name,
            exc,
            exc_info=True,
        )
        return None


@lru_cache(maxsize=1)
def discover_packs() -> list[PartnerPackManifest]:
    """Return all packs registered via the entry-point group.

    Cached for the lifetime of the process. Call ``discover_packs.cache_clear()``
    in tests that install or remove a pack at runtime.
    """
    try:
        eps = entry_points(group=ENTRY_POINT_GROUP)
    except TypeError:
        # Python 3.9 fallback (the codebase requires 3.12 but be defensive).
        eps = entry_points().get(ENTRY_POINT_GROUP, [])  # type: ignore[assignment]

    manifests: list[PartnerPackManifest] = []
    for ep in eps:
        manifest = _load_one(ep)
        if manifest:
            manifests.append(manifest)
    manifests.sort(key=lambda m: m.slug)
    if manifests:
        logger.info(
            "Discovered %d partner pack(s): %s",
            len(manifests),
            ", ".join(m.slug for m in manifests),
        )
    return manifests


def get_pack_by_slug(slug: str) -> PartnerPackManifest | None:
    """Return the discovered pack whose slug matches, or None."""
    for m in discover_packs():
        if m.slug == slug:
            return m
    return None


@lru_cache(maxsize=1)
def get_active_pack() -> PartnerPackManifest | None:
    """Pick the active pack.

    Precedence:
      1. env ``OE_PARTNER_PACK=<slug>``
      2. first discovered pack
      3. None
    """
    requested = os.environ.get("OE_PARTNER_PACK", "").strip()
    if requested:
        m = get_pack_by_slug(requested)
        if m:
            logger.info("Active partner pack (env-selected): %s", m.slug)
            return m
        logger.warning(
            "OE_PARTNER_PACK=%s requested but no such pack is installed.",
            requested,
        )
    discovered = discover_packs()
    if discovered:
        chosen = discovered[0]
        logger.info("Active partner pack (auto-selected): %s", chosen.slug)
        return chosen
    return None


def get_active_pack_module_name() -> str | None:
    """Return the Python module name of the active pack, for resource loading.

    Resolves to e.g. ``openconstructionerp_batimatech_ca``. Used by
    ``router.py`` to stream the partner logo and onboarding script out of
    the installed pack package via ``importlib.resources``.
    """
    active = get_active_pack()
    if not active:
        return None
    try:
        eps = entry_points(group=ENTRY_POINT_GROUP)
    except TypeError:
        eps = entry_points().get(ENTRY_POINT_GROUP, [])  # type: ignore[assignment]
    for ep in eps:
        if ep.name == active.slug:
            # ep.value is "module:attr" — return the module part
            return ep.value.split(":", 1)[0]
    return None


def reset_cache() -> None:
    """Reset the discovery caches. Used by tests."""
    discover_packs.cache_clear()
    get_active_pack.cache_clear()
