"""Build the ``PartnerPackManifest`` instance for the batimatech-ca pack.

Kept in its own module so unit tests can import the manifest without
triggering the package ``__init__`` side-effects.
"""

from __future__ import annotations

from app.core.partner_pack.manifest import PartnerBranding, PartnerPackManifest

MANIFEST = PartnerPackManifest(
    slug="batimatech-ca",
    partner_name="batimatech",
    partner_url="https://batimatech.ca",
    pack_version="0.1.0",
    description=(
        "Pré-configuré pour les entreprises canadiennes de construction — "
        "normes NBC, contrats CCDC, base de coûts RSMeans Canada."
    ),
    default_locale="fr-CA",
    additional_locales={
        "fr-CA": "locales/fr-CA.json",
        "en-CA": "locales/en-CA.json",
    },
    cwicr_regions=[
        "cwicr-eng-toronto",
        "cwicr-fra-montreal",
    ],
    default_currency="CAD",
    default_tax_template="ca_gst_pst",
    validation_rule_packs=[
        "nbc_2020",
        "ccdc_2",
        "csa_a23",
    ],
    default_modules=[],   # empty = show all (Shape A, no module hiding)
    hidden_modules=[],
    branding=PartnerBranding(
        primary_color="#BE1B2F",   # batimatech red
        accent_color="#0F2C5F",    # Canadian navy
        logo_path="logo.svg",
        favicon_path="favicon.ico",
        powered_by_text=None,      # use default co-branding string
    ),
    onboarding_script_path="onboarding.yaml",
    metadata={
        "country": "CA",
        "country_name_en": "Canada",
        "country_name_fr": "Canada",
        "regulator_refs": ["NBC 2020", "CCDC", "CSA A23"],
        "support_email": "contact@batimatech.ca",
    },
)
