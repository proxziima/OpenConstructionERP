"""Manifest for the Doker formwork partner pack.

Pre-configures OpenConstructionERP for formwork (Schalung) and
concrete contractors: German locale overrides, DIN 18218 fresh-concrete
pressure validation, DIN EN 206 concrete quality rules, and a formwork
cycle quality rule pack.
"""

from __future__ import annotations

from app.core.partner_pack.manifest import PartnerBranding, PartnerPackManifest

MANIFEST = PartnerPackManifest(
    slug="doker-formwork",
    partner_name="Doker",
    partner_url="https://doker.com",
    pack_version="0.1.0",
    description=(
        "Vorkonfiguriert für Schalungs- und Betonbau-Unternehmen — "
        "Schalungszyklus-Planung, DIN 18218 Frischbetondruck, "
        "Bewehrung-Auszüge."
    ),
    default_locale="de",
    additional_locales={"de": "locales/de.json"},
    cwicr_regions=["cwicr-de-berlin"],
    default_currency="EUR",
    default_tax_template=None,
    validation_rule_packs=[
        "din_18218_formwork_pressure",
        "formwork_cycle_quality",
        "concrete_din_en_206",
    ],
    default_modules=[],
    hidden_modules=[],
    branding=PartnerBranding(
        primary_color="#003D7A",
        accent_color="#F58220",
        logo_path="logo.svg",
        favicon_path=None,
        powered_by_text=None,
    ),
    onboarding_script_path="onboarding.yaml",
    metadata={
        "industry": "formwork",
        "primary_market": "DACH",
        "focus": ["schalung", "beton", "bewehrung"],
    },
)
