"""Build the ``PartnerPackManifest`` instance for the us-rsmeans pack.

Kept in its own module so unit tests can import the manifest without
triggering the package ``__init__`` side-effects.
"""

from __future__ import annotations

from app.core.partner_pack.manifest import PartnerBranding, PartnerPackManifest

MANIFEST = PartnerPackManifest(
    slug="us-rsmeans",
    partner_name="US Construction Pack",
    partner_url=None,
    pack_version="0.1.0",
    description=(
        "Pre-configured for US general contractors — MasterFormat 2018, "
        "AIA A201 contract, RSMeans national + city cost indices."
    ),
    default_locale="en-US",
    additional_locales={},
    cwicr_regions=[
        "cwicr-eng-newyork",
    ],
    default_currency="USD",
    default_tax_template="us_state_sales_tax",
    validation_rule_packs=[
        "masterformat_2018",
        "aia_a201_2017",
        "rsmeans_city_index",
    ],
    default_modules=[],   # empty = show all
    hidden_modules=[],
    branding=PartnerBranding(
        primary_color="#0A3161",   # Old Glory blue
        accent_color="#B31942",    # Old Glory red
        logo_path="logo.svg",
        favicon_path=None,
        powered_by_text=None,      # use default co-branding string
    ),
    onboarding_script_path="onboarding.yaml",
    metadata={
        "country": "US",
        "country_name_en": "United States",
        "regulator_refs": ["CSI MasterFormat 2018", "AIA A201-2017", "RSMeans"],
        "support_email": "info@datadrivenconstruction.io",
    },
)
