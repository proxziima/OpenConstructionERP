# OpenConstructionERP × batimatech (Canada)

Partner pack pre-configuring [OpenConstructionERP](https://github.com/DataDrivenConstruction/openconstructionerp)
for Canadian construction companies.

> **Pré-configuré pour les entreprises canadiennes de construction —
> normes NBC, contrats CCDC, base de coûts RSMeans Canada.**

## What this pack does

When installed alongside the OCERP core, this pack registers via the
`openconstructionerp.partner_packs` entry-point and the host application:

- Switches the default locale to **fr-CA** (Canadian French), with **en-CA**
  available as a secondary locale. Falls back to `en` for untranslated keys.
- Preloads CWICR cost regions: **cwicr-eng-toronto** and **cwicr-fra-montreal**.
- Sets default currency to **CAD** and applies the **`ca_gst_pst`** tax template.
- Enables three Canadian validation rule packs:
  - `nbc_2020` — National Building Code of Canada 2020
  - `ccdc_2` — CCDC-2 Stipulated Price Contract structure
  - `csa_a23` — CSA A23 concrete specification compliance
- Applies batimatech branding (`#BE1B2F` red + `#0F2C5F` Canadian navy)
  and replaces the boot logo / favicon.
- Replaces the default first-login onboarding wizard with a 6-step Canadian
  workflow (NBC, CCDC contract type, CWICR regions, bilingual EN-CA/FR-CA).

The pack ships **no** new validation rule classes (Shape A) — it only
switches on rules already present in the OCERP core. No modules are hidden;
the full sidebar remains available.

## Install

```bash
pip install openconstructionerp-batimatech-ca
# then restart the OCERP backend — the pack is auto-discovered.
```

To deactivate, simply `pip uninstall openconstructionerp-batimatech-ca`
and restart.

## License

AGPL-3.0-or-later, same as the OCERP core. The batimatech name and red
brand colour are trademarks of batimatech and used under partnership
agreement.
