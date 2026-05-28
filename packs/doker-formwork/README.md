# OpenConstructionERP × Doker — Formwork Partner Pack

Pre-configures OpenConstructionERP for **formwork (Schalung) and
concrete contractors** in the DACH region.

## What it does

When installed alongside `openconstructionerp`, this pack:

- Sets German (`de`) as the default locale, with formwork-specific term
  overrides (Schalung, Bewehrung, Beton, Zyklus, Aufschüttung …)
- Preloads the **CWICR Berlin** cost region
- Enables three validation rule packs:
  - `din_18218_formwork_pressure` — fresh-concrete pressure on vertical formwork
  - `formwork_cycle_quality` — completeness of the shuttering → curing cycle
  - `concrete_din_en_206` — concrete specification compliance
- Replaces the default onboarding wizard with a 5-step Schalung flow
- Applies Doker branding (logo, primary `#003D7A`, accent `#F58220`)

## Install

```bash
pip install openconstructionerp-doker-formwork
```

The pack is discovered automatically via the
`openconstructionerp.partner_packs` entry-point group. To force-select
it when multiple packs are installed:

```bash
export OE_PARTNER_PACK=doker-formwork
```

## License

AGPL-3.0-or-later, same as the OpenConstructionERP core.
