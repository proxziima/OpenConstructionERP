"""Build the ``PartnerPackManifest`` instance for the uk-jct pack.

Kept in its own module so unit tests can import the manifest without
triggering the package ``__init__`` side-effects.
"""

from __future__ import annotations

from app.core.partner_pack.manifest import PartnerBranding, PartnerPackManifest

MANIFEST = PartnerPackManifest(
    slug="uk-jct",
    partner_name="UK Construction Pack",
    partner_url=None,
    pack_version="0.1.0",
    description=(
        "Pre-configured for UK general contractors — NRM 1 (Cost Planning) + "
        "NRM 2 (Detailed Measurement), JCT contract suite, BCIS cost benchmarks."
    ),
    default_locale="en-GB",
    additional_locales={},
    cwicr_regions=[
        "cwicr-eng-london",
    ],
    default_currency="GBP",
    default_tax_template="uk_vat_20",
    validation_rule_packs=[
        "nrm_1_cost_planning",
        "nrm_2_detailed_measurement",
        "jct_contract_clauses",
        "bcis_benchmarks",
    ],
    default_modules=[],   # empty = show all
    hidden_modules=[],
    branding=PartnerBranding(
        primary_color="#012169",   # Union flag blue
        accent_color="#C8102E",    # Union flag red
        logo_path="logo.svg",
        favicon_path=None,
        powered_by_text=None,      # use default co-branding string
    ),
    onboarding_script_path="onboarding.yaml",
    metadata={
        "country": "GB",
        "country_name_en": "United Kingdom",
        "regulator_refs": ["RICS NRM 1", "RICS NRM 2", "JCT 2016", "BCIS"],
        "support_email": "info@datadrivenconstruction.io",
    },
)
