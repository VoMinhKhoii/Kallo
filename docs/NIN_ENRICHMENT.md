# NIN enrichment

The NIN snapshot is an additive source. It must not be used to rewrite names,
aliases, nutrients, state, or provenance on existing FAO or USDA rows.

## Alias-carrier decisions

These decisions are final for this ingestion. They preserve the additive-only
boundary and prefer a composition-correct existing fallback over a convenient
but false alias on a flavored NIN row.

| Query | Decision | Rationale and implementation |
|---|---|---|
| Plain `xôi` | Use `usda_20055_cooked` (cooked glutinous rice). | The additive pre-match alias `xôi` → `xôi trắng` routes to its existing composition-correct name. No NIN `name_alt` is added: every NIN xôi row is flavored or includes another ingredient. |
| Cooked mung bean | Use unsalted `usda_16081_cooked`. | This is the neutral whole-boiled-bean fallback; `usda_16381_cooked` includes salt. Existing cooked aliases already cover `đậu xanh luộc`, `đỗ xanh luộc`, and `đậu xanh chín`, so no existing row is mutated and no inaccurate NIN alias is needed. Plain `đậu xanh` remains state-ambiguous and is not forcibly rewritten to cooked. |
| `hành phi` | **Deferred.** | Trigger: a verified per-100g fried-shallot composition row with redistribution permission. NIN `4132 Hành khô` is dried shallot, while USDA onion rings are battered; either alias would be a composition error. The future fix must add a new sourced row, not mutate either carrier. |

## Reviewer-of-record quality decisions

- NIN's 1-kcal sentinel is corrected to 0 kcal only for salt (`13005`),
  mineral water (`14008`), and ice (`14057`), whose proximate profiles establish
  true near-zero energy. They proceed to normal duplicate handling instead of
  being quarantined for the placeholder alone.
- The 1-kcal brewed-tea rows (`14069`, `14070`) are also retained because their
  reported macros independently compute to approximately 1 kcal. Their cloned
  vector keeps the generic `Trà túi lọc` representative rather than branded
  `Trà Neste`.
- Rows with unexplained or incomplete energy-bearing fields remain quarantined,
  even when the stated calories are plausible (for example vinegar, MSG, and
  orange/lemon liqueur). This ingestion promises coherent calories plus macros,
  not calories alone.
- Bowl rows and the explicitly approved `12089`–`12091` bánh rows are exempt
  from nutrient-vector clone collapse so each receives the required semantic
  label. Bowl rows are then excluded by that label.

## Reviewer-of-record audit (2026-08-12)

- All 803 post-quarantine/post-clone labels were reviewed. The sole semantic
  relabel was `15040 Caramen`, from ingredient to composite. Rows `12090` and
  `15075` were restored to the label artifact after the clone-stage exception;
  they are composite and bowl respectively.
- All 27 remaining quarantines were reviewed. Each is still unusable for this
  calories-plus-macros ingestion because it has a placeholder/corrupt value,
  unexplained incomplete energy fields, a fabricated vector, or a cloned
  implausible mollusk vector. No verified near-zero food remains quarantined.
- All 18 clone groups were reviewed. Explicit generic representatives are
  unbranded tea (`14070`), common boiled chicken thigh (`7105002`), fresh sea
  shrimp (`8051`), and white clam (`8066`). Other heterogeneous clone groups
  have no honest shared generic identity; the deterministic least-qualified
  source name is retained, and dropped names are not added as aliases.
- A deterministic sample (seed `20260812`) of 25 Vietnamese-duplicate verdicts
  and 25 kept verdicts was checked in both state directions. The sample passed.
  The full directional scan found and fixed one systematic issue: explicitly
  cooked `7067 Dồi lợn, chín` and `7068 Giò bò, chín` no longer collapse onto
  legacy `_raw` lineages. Ripe `chín, tươi` fruit remains correctly raw.
