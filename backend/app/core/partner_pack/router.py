"""HTTP surface for the active partner pack."""

from __future__ import annotations

import logging
from importlib import resources
from typing import Any

from fastapi import APIRouter, HTTPException, Response

from app.core.partner_pack.discovery import (
    discover_packs,
    get_active_pack,
    get_active_pack_module_name,
    get_pack_by_slug,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/partner-pack", tags=["partner-pack"])


@router.get("/current", summary="Active partner pack manifest")
def current_pack() -> dict[str, Any]:
    """Return the active pack's public manifest, or ``{"active": false}``.

    Frontend calls this on app boot to decide whether to mount the
    PartnerLogoBadge + adjust theme colours + load extra locales.
    """
    active = get_active_pack()
    if not active:
        return {"active": False}
    return {"active": True, "manifest": active.to_public_dict()}


@router.get("/installed", summary="All discovered packs (admin view)")
def list_installed() -> dict[str, Any]:
    """Return the list of all installed packs and which one is active."""
    active = get_active_pack()
    return {
        "active_slug": active.slug if active else None,
        "installed": [m.to_public_dict() for m in discover_packs()],
    }


def _read_pack_resource(filename: str) -> bytes | None:
    """Read a file from inside the active pack package via importlib.resources.

    Returns None if the active pack is missing or the file does not exist.
    """
    mod_name = get_active_pack_module_name()
    if not mod_name:
        return None
    try:
        files = resources.files(mod_name)
        target = files.joinpath(filename)
        if not target.is_file():
            return None
        return target.read_bytes()
    except (ModuleNotFoundError, FileNotFoundError, AttributeError):
        return None


@router.get("/logo", summary="Stream the partner logo")
def partner_logo() -> Response:
    """Stream the partner logo SVG/PNG out of the installed pack package.

    Returns 404 if no pack is active or the pack does not ship a logo.
    Content-Type sniffed from the filename extension.
    """
    active = get_active_pack()
    if not active:
        raise HTTPException(status_code=404, detail="No active partner pack")
    data = _read_pack_resource(active.branding.logo_path)
    if data is None:
        raise HTTPException(
            status_code=404,
            detail=f"Active pack '{active.slug}' has no logo at {active.branding.logo_path!r}",
        )
    ext = active.branding.logo_path.rsplit(".", 1)[-1].lower()
    media_type = {
        "svg": "image/svg+xml",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "webp": "image/webp",
    }.get(ext, "application/octet-stream")
    return Response(
        content=data,
        media_type=media_type,
        # Logos rarely change; cache aggressively but allow revalidation.
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.get("/favicon", summary="Stream the partner favicon")
def partner_favicon() -> Response:
    """Stream the partner favicon if one is shipped."""
    active = get_active_pack()
    if not active or not active.branding.favicon_path:
        raise HTTPException(status_code=404, detail="No partner favicon")
    data = _read_pack_resource(active.branding.favicon_path)
    if data is None:
        raise HTTPException(status_code=404, detail="Favicon file missing in pack")
    return Response(content=data, media_type="image/x-icon")


@router.get("/onboarding-script", summary="Partner onboarding script (YAML/JSON)")
def partner_onboarding_script() -> Response:
    """Stream the onboarding YAML/JSON shipped by the active pack.

    Frontend OnboardingWizard fetches this and renders partner-specific
    steps instead of the default sequence.
    """
    active = get_active_pack()
    if not active or not active.onboarding_script_path:
        raise HTTPException(status_code=404, detail="No partner onboarding script")
    data = _read_pack_resource(active.onboarding_script_path)
    if data is None:
        raise HTTPException(
            status_code=404, detail="Onboarding script file missing in pack"
        )
    ext = active.onboarding_script_path.rsplit(".", 1)[-1].lower()
    media_type = "application/json" if ext == "json" else "text/yaml"
    return Response(content=data, media_type=media_type)


@router.get("/locale/{code}", summary="Partner-shipped locale JSON")
def partner_locale(code: str) -> Response:
    """Stream an additional locale file shipped by the active pack."""
    active = get_active_pack()
    if not active:
        raise HTTPException(status_code=404, detail="No active partner pack")
    path = active.additional_locales.get(code)
    if not path:
        raise HTTPException(
            status_code=404,
            detail=f"Pack '{active.slug}' does not ship locale '{code}'",
        )
    data = _read_pack_resource(path)
    if data is None:
        raise HTTPException(status_code=404, detail="Locale file missing in pack")
    return Response(content=data, media_type="application/json")


@router.get(
    "/by-slug/{slug}", summary="Inspect a non-active pack (admin / pre-install preview)"
)
def inspect_pack(slug: str) -> dict[str, Any]:
    """Return the public manifest of any installed pack by slug."""
    m = get_pack_by_slug(slug)
    if not m:
        raise HTTPException(status_code=404, detail=f"Pack '{slug}' not installed")
    return m.to_public_dict()
