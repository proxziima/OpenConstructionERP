"""BIMHessen partner pack manifest."""

from __future__ import annotations

from app.core.partner_pack.manifest import PartnerBranding, PartnerPackManifest

MANIFEST = PartnerPackManifest(
    slug="bimhessen-de",
    partner_name="BIMHessen",
    partner_url="https://bimhessen.de",
    pack_version="0.1.0",
    description=(
        "Vorkonfiguriert für deutsche BIM-Berater — DIN 276, GAEB X83/X86, "
        "VOB-Klauseln, ISO 19650 CDE, BKI Benchmarks."
    ),
    default_locale="de",
    additional_locales={"de": "locales/de.json"},
    cwicr_regions=["cwicr-de-berlin"],
    default_currency="EUR",
    default_tax_template=None,
    validation_rule_packs=[
        "din_276",
        "gaeb_x83_x86",
        "vob_2023",
        "iso_19650_cde",
        "bki_benchmarks",
    ],
    default_modules=[],
    hidden_modules=[],
    branding=PartnerBranding(
        primary_color="#005CA9",
        accent_color="#E30613",
        logo_path="logo.svg",
        favicon_path=None,
        powered_by_text=None,
    ),
    onboarding_script_path="onboarding.yaml",
)
