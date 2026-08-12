# NIN enrichment

The NIN snapshot is an additive source. It must not be used to rewrite names,
aliases, nutrients, state, or provenance on existing FAO or USDA rows.

## Alias coverage gaps requiring a product decision

The NIN foods snapshot has no composition-safe generic carrier for these three
queries. The ingestion therefore leaves the gaps unresolved rather than adding
an alias to an existing database row.

| Query | Why NIN cannot carry it | Recommended options |
|---|---|---|
| Plain `xôi` | NIN only has specific preparations such as xôi nếp cẩm, xôi đỗ xanh, xôi gấc, xôi lạc, xôi ngô, and xôi xéo. | Keep the existing cooked glutinous-rice USDA row (`usda_20055_cooked`) as the fallback, or add a separately sourced `xôi trắng` row. Do not attach plain `xôi` to a flavored NIN variant. |
| Cooked mung bean | NIN has raw mung-bean flour and prepared dishes, but no plain cooked bean row. | Use an existing cooked USDA mung-bean row (`usda_16081_cooked` or `usda_16381_cooked`) only if whole boiled mung bean is the intended food; otherwise add a verified Vietnamese row for peeled/steamed mung bean. |
| `hành phi` | NIN's `Hành khô` is dried shallot, not fried shallot, and the available USDA onion-ring rows are battered products. | Leave unresolved until a verified per-100g fried-shallot source can be inserted as a new curated row. Do not alias it to dried shallot or onion rings. |

All three options preserve the additive-only boundary: a future resolution adds
a new sourced row or changes query routing after approval; it does not mutate
the existing composition records during NIN ingestion.
