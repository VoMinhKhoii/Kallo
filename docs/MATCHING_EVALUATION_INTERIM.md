# Interim matching evaluation: 11,456 completed cases

Generated 2026-10-05T03:29:41.514Z. **11456 / 35,122 (32.62%) completed. Full run remains pending.**

Code audit baseline: `f8d04ad0`, inspected on 2026-10-04 in
`chore/matching-audit`. Findings describe that frozen evaluation baseline,
not a verified production revision or subsequent changes on `main`.

This is an audited sequential prefix, not a representative random sample or the final report. No provider request, database query or remote write was needed to assemble it. The existing worker and its genuine cooldowns are unchanged.

## What can be decided today

All 340 global scenarios (81 cuisine/country contexts, 25 families) and all 524 state probes are complete. They support investigation of ingredient identity, cuts and cooking-state retrieval. Database-name tests cover 5328 / 7741 food rows. The 18,842-case alias tier has not started.

The main product evaluation should follow natural meal text through Gemini decomposition and then retrieval. These tests supply decomposition directly and therefore do not measure Gemini normalization. Alternate names remain useful embedding/search metadata; exhaustive alias reachability is a secondary diagnostic, and broad aliases cannot uniquely identify detailed USDA variants.

Prioritize source registry correctness, identity/state-aware exact matching, retained cut/fat/skin/preparation details, and compatibility checks before candidate truncation. The preserved full run can continue independently while those proposals are reviewed.

## Completion and scores

| Tier | Completed | Planned | Coverage |
| --- | ---: | ---: | ---: |
| scenarios | 340 | 340 | 100.00% |
| states | 524 | 524 | 100.00% |
| database | 10592 | 15416 | 68.71% |
| aliases | 0 | 18842 | 0.00% |

| Group | Executed | Scorable | No gold | Recall@3 | Rank-one | MRR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| scenarios | 340 | 322 | 18 | 95.34% | 91.61% | 0.9332 |
| states | 524 | 374 | 150 | 78.88% | 75.94% | 0.7727 |
| database | 10592 | 10537 | 55 | 95.32% | 89.59% | 0.9232 |
| aliases | 0 | 0 | 0 | — | — | — |

No-gold cases are excluded from score denominators. Scenario labels are provisional and need expert review. Inventory labels accept equivalent English descriptions only in the same state. Tier scores must remain separate; no pooled natural-meal accuracy is reported.

### State probes by target

| Group | Executed | Scorable | No gold | Recall@3 | Rank-one | MRR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| raw | 262 | 243 | 19 | 90.53% | 87.24% | 0.8868 |
| cooked | 262 | 131 | 131 | 57.25% | 54.96% | 0.5611 |

## Database-name coverage by originating source

| Source | Queried food rows | Inventory rows | Name tests completed | Name tests planned |
| --- | ---: | ---: | ---: | ---: |
| FAO_VN_2007 | 526 | 526 | 1041 | 1041 |
| USDA_SR | 4532 | 6945 | 9057 | 13881 |
| OFF | 12 | 12 | 23 | 23 |
| NIN_WEB_2026 | 258 | 258 | 471 | 471 |

| Group | Executed | Scorable | No gold | Recall@3 | Rank-one | MRR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| FAO_VN_2007 | 1041 | 1031 | 10 | 99.81% | 99.81% | 0.9981 |
| USDA_SR | 9057 | 9057 | 0 | 99.54% | 92.87% | 0.9605 |
| OFF | 23 | 23 | 0 | 0.00% | 0.00% | 0.0000 |
| NIN_WEB_2026 | 471 | 426 | 45 | 0.00% | 0.00% | 0.0000 |

Missing inventory-name families: Soups, Sauces, and Gravies; Fats and Oils; Breakfast Cereals; Poultry Products; Fruits and Fruit Juices. Scenarios and state probes may already include ingredients in these families. Sequential inventory ordering biases the observed database-name scores; do not extrapolate them to unexecuted families.

## USDA database shape

6945 USDA rows: 4846 raw-labelled and 2099 cooked-labelled. Import labels do not guarantee every ingredient has a raw/cooked pair or every world cuisine has an exact entry.

| Descriptor (overlapping) | Rows |
| --- | ---: |
| solution | 62 |
| sauce | 78 |
| skin | 217 |
| trimmed | 958 |
| lean only | 663 |
| lean and fat | 773 |
| breast | 59 |
| thigh | 30 |
| drumstick | 36 |
| tenderloin | 75 |
| brisket | 43 |
| ground | 102 |

## Failure clusters in completed observations

587 scorable identity misses; 223 no-gold cases. The signals below overlap and do not isolate causality.

| Signal among identity misses | Count |
| --- | ---: |
| Empty candidate pool | 90 |
| Nonempty pool entirely outside explicit target state | 126 |
| Exact shortcut misses accepted identity/state | 14 |
| Accepted gold exclusively NIN or OFF | 462 |
| Enhanced candidate absent from every accepted gold row | 9 |

## Findings

The matcher needs a source-independent food identity model, rather than more
phrase-to-row patches. Both data quality and candidate selection contribute.

### 1. A complete candidate pool is missing for some perfectly ordinary queries

For `Thịt bò tái`, the live retrieval-only baseline returned:

| Row | English description | Protein / fat per 100g |
| --- | --- | --- |
| `usda_13346_raw` | Beef, cured, corned beef, brisket, raw | 14.68g / 14.9g |
| `usda_13330_raw` | Beef, variety meats and by-products, mechanically separated beef, raw | 14.97g / 23.52g |
| `usda_13317_cooked` | Beef, ground, patties, frozen, cooked, broiled | 23.05g / 21.83g |

None represents the intended plain, thin-sliced rare beef. Call 2 cannot pick
a correct row that never reaches it. It can reject the pool, but this still
loses the available database anchor. This run did **not** execute Call 2, so
these are observed candidates, not asserted final meal macros.

`tái` describes doneness, not anatomy. Do not permanently rewrite it to
tenderloin. Explicit tenderloin/filet requests belong to that cut family;
unspecified phở tái should retain cut uncertainty and use a reviewed set of
lean sliced-beef proxies. Compare preparation, trim and state as well as cut.

Relevant code: `lib/ai/matching/retrieve/top-k-context.ts`,
`top-k-retrieval.ts`, `lib/ai/matching/rank/candidate-eligibility.ts`.
Only the canonical name reaches retrieval; raw name, prep notes and dish
context do not participate in identity eligibility. Existing eligibility
guards are limited to certain chicken species and isolated skin/fat.

### 2. Source IDs silently exclude newly imported food

The live inventory contains:

| Source code | Actual ID | Rows | Missing embeddings |
| --- | --- | ---: | ---: |
| FAO_VN_2007 | 1 | 526 | 0 |
| USDA_SR | 2 | 6,945 | 0 |
| OFF | 5 | 12 | 12 |
| NIN_WEB_2026 | 6 | 258 | 0 |

`lib/ai/matching/match-constants.ts` recognizes NIN as ID **4**, and OFF as
**3**. `splitBySource` drops IDs 5 and 6. SQL partitions by the actual
`source_id`, so a returned NIN candidate disappears in JavaScript. Fix the
source policy using `ingredient_sources.code`; do not merely substitute one
magic ID for another. Packaged-product rows need an explicit applicability
policy, rather than an accidental omission from the split.

### 3. Exact FAO hits bypass both richer sources and state checks

`resolveExactMatch` restricts lookup to `source_id = 1`, ignores its
`_expectedState` argument, and returns one row immediately. The cascade then
skips the hybrid pool and the explicit weighing-state filter for that row.
An exact *string* is not proof of the best *food identity and state*.

The cooked buffalo tenderloin scenario returned the raw FAO loin even though
`nin_web_7027002` and `nin_web_7027018` contain cooked tenderloin data. This
combines the shortcut and source-ID defects.

### 4. The state vocabulary does not cover global cooking methods

`lib/ai/pipeline/contracts/cooking-method-state.ts` recognizes Vietnamese
methods and `raw`, but not `boiled`, `grilled`, `roasted`, `steamed`, or
`chần`. V2 turns an unrecognized method into `unknown`, disabling the state
penalty. `tái` is mapped to `raw`, conflating rare preparation with a raw
reference/measurement basis. Also, `cooked_weight` is routed to `as_eaten`,
which does not itself pin the expected state; the later explicit-state
filter cannot recover correct rows removed before top-K truncation.

### 5. USDA qualifiers carry identity information that translations obscure

USDA's imported English descriptions include 62 rows mentioning `solution`
and 78 mentioning `sauce`; these sets are not the same. For example,
`usda_10952_cooked` describes pork tenderloin **with added solution**, while
its Vietnamese name says **có thêm nước sốt**. Several chicken rows have the
same error. A normal meat query can therefore compete with enhanced meat
under an ordinary cut alias.

Added solutions are ingredients incorporated into meat for flavoring,
seasoning or tenderizing; they are not simply a separate sauce eaten with
the dish. See [USDA FSIS: Water in Meat and Poultry](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/water-meat-poultry).

Call 2 receives the authoritative English description only when the prompt
locale is `global` (`lib/ai/prompts/build/grounded-estimation.ts`). Vietnamese
users therefore lose a useful way to detect translated qualifier errors.
Make source descriptors available in both locales.

### 6. The candidate pool is truncated before enough compatibility checks

The default is three rows per source per retrieval arm, three per merged
arm, and three after RRF. Chicken has a special eight-row overfetch. Grade,
trim, state and enhancement variants can fill those slots before a better
cut or preparation is considered. A larger fetch is an experiment, not the
whole fix: filter/rank by identity, then deduplicate near-identical variants
and select a diverse final pool within the existing latency budget.

## What should happen to old workarounds?

Keep true equivalents (spelling variants, `cá lóc` / `cá quả`). Replace
lossy food substitutions with explicit concept/proxy relationships, preserving
the original user identity. For example, the pre-match `carne asada` alias
currently embeds a full Vietnamese description of one USDA flank row; it
should express a recipe context and acceptable cuts, not force one row.

The `cơm → Gạo tẻ` map is still present, but it belongs to the legacy alias
fallback. The active V2 cascade does not call that fallback. Current V2
decomposition already teaches `Cơm`, specific chicken parts and beef cuts.
This is not just a stale decomposition-prompt bug.

Prefer the correct prepared row and avoid conversion when row basis matches
the measured portion. Do not delete every conversion solely because USDA has
many rows: USDA has **4,846 raw-labelled and 2,099 cooked-labelled rows**,
and imported plain pork belly has only `usda_10005_raw`. Light coconut milk,
udon, paneer and dashi also lack exact description labels in this snapshot;
these are coverage probes, not proof that no acceptable proxy exists.

The importer defaults unrecognized descriptions to `raw`. Kimchi and miso
are labelled raw despite being processed foods, so binary `state` is not a
complete preparation model. USDA SR Legacy itself is a finite dataset, and
this importer explicitly excludes six categories; it cannot guarantee every
world food and preparation. [USDA SR Legacy documentation](https://www.ars.usda.gov/ARSUserFiles/80400525/Data/SR-Legacy/SR-Legacy_Doc.pdf).

V2 already treats Call-2 mass as the selected row's basis, and its bridge
bypasses the legacy deterministic cooked-to-raw factor. The remaining V2
yield conversion is instructed in Call 2 when only a different-basis row is
available. Preserve a visible, calibrated fallback for those cases; distinguish
it from exact same-basis nutrition and avoid double conversion.

## Proposed implementation order

1. Correct source resolution and make exact lookup state/identity aware.
   Surface authoritative English descriptions in both prompt locales. Cover
   the state vocabulary and explicit cooked-weight handling. These changes
   require no new food rows.
2. Introduce a typed food identity profile derived from authoritative source
   descriptors: species, cut/part, preparation, state, lean/fat percentage,
   skin, separable fat, enhancement/solution, sauce/breading, draining and
   brand. Represent unknown fields explicitly. Build it offline with
   provenance and review uncertain mappings; do not add a per-meal LLM call.
   Its persistence/schema design is a separate implementation decision.
3. Build a query intent from canonical name **and** original name, explicit
   modifiers, weighing basis and dish context. Search Vietnamese and English
   equivalents without rewriting a specific food into a generic FAO row.
4. Apply categorical compatibility before limiting the pool. Plain meat
   should prefer unenhanced rows; explicit enhanced meat and actual sauce
   requests must keep their correct rows. Hard reject known species/cut
   conflicts; handle unknown cuts with reviewed proxies and uncertainty.
5. Overfetch under a measured budget, rank compatible rows, and remove
   redundant grade/trim siblings. Preserve state and identity diversity in
   the final three candidates. Verify this against the existing 10s matching
   deadline and calibrated match-stage p95 budget.
6. Curate translation/alias defects from the failure clusters. Re-embed only
   corrected descriptions after the user applies reviewed migrations. Do not
   globally lower acceptance thresholds or globally ban sauces/solution rows.

Gate each phase on retrieval identity, same-basis availability, wrong-cut and
enhanced-meat contamination, source coverage, and end-to-end CRAG selection.
Then measure protein/fat error at a fixed edible mass on expert-reviewed row
families. Similar names or the same anatomical cut do not by themselves prove
nutritional equivalence across trim and preparation.



## Per-family results

| Group | Executed | Scorable | No gold | Recall@3 | Rank-one | MRR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| scenarios / beef | 12 | 12 | 0 | 91.67% | 91.67% | 0.9167 |
| scenarios / poultry | 12 | 11 | 1 | 72.73% | 54.55% | 0.6061 |
| scenarios / organs | 7 | 7 | 0 | 100.00% | 100.00% | 1.0000 |
| scenarios / fats | 9 | 9 | 0 | 100.00% | 100.00% | 1.0000 |
| scenarios / pork | 12 | 12 | 0 | 100.00% | 91.67% | 0.9583 |
| scenarios / other-meat | 13 | 12 | 1 | 83.33% | 83.33% | 0.8333 |
| scenarios / fish | 24 | 23 | 1 | 95.65% | 82.61% | 0.8913 |
| scenarios / shellfish | 16 | 16 | 0 | 100.00% | 100.00% | 1.0000 |
| scenarios / grains | 29 | 29 | 0 | 100.00% | 96.55% | 0.9828 |
| scenarios / noodles | 8 | 7 | 1 | 100.00% | 100.00% | 1.0000 |
| scenarios / bread | 7 | 7 | 0 | 100.00% | 100.00% | 1.0000 |
| scenarios / legumes | 32 | 32 | 0 | 96.88% | 96.88% | 0.9688 |
| scenarios / eggs | 5 | 4 | 1 | 100.00% | 75.00% | 0.8750 |
| scenarios / dairy | 18 | 16 | 2 | 100.00% | 100.00% | 1.0000 |
| scenarios / fruit | 26 | 22 | 4 | 100.00% | 95.45% | 0.9697 |
| scenarios / plant-milk | 4 | 3 | 1 | 100.00% | 66.67% | 0.8333 |
| scenarios / vegetables | 33 | 33 | 0 | 87.88% | 87.88% | 0.8788 |
| scenarios / sauces | 12 | 8 | 4 | 87.50% | 87.50% | 0.8750 |
| scenarios / roots | 13 | 13 | 0 | 92.31% | 92.31% | 0.9231 |
| scenarios / nuts-seeds | 17 | 17 | 0 | 100.00% | 88.24% | 0.9412 |
| scenarios / sweeteners | 4 | 3 | 1 | 100.00% | 100.00% | 1.0000 |
| scenarios / spices | 15 | 15 | 0 | 93.33% | 93.33% | 0.9333 |
| scenarios / broth | 2 | 1 | 1 | 100.00% | 100.00% | 1.0000 |
| scenarios / beverages | 6 | 6 | 0 | 100.00% | 100.00% | 1.0000 |
| scenarios / desserts | 4 | 4 | 0 | 100.00% | 100.00% | 1.0000 |
| states / beef | 20 | 20 | 0 | 55.00% | 55.00% | 0.5500 |
| states / poultry | 20 | 18 | 2 | 66.67% | 55.56% | 0.5926 |
| states / organs | 14 | 13 | 1 | 84.62% | 84.62% | 0.8462 |
| states / fats | 18 | 12 | 6 | 83.33% | 83.33% | 0.8333 |
| states / pork | 24 | 22 | 2 | 95.45% | 95.45% | 0.9545 |
| states / other-meat | 20 | 18 | 2 | 77.78% | 77.78% | 0.7778 |
| states / fish | 30 | 27 | 3 | 74.07% | 62.96% | 0.6852 |
| states / shellfish | 16 | 16 | 0 | 62.50% | 62.50% | 0.6250 |
| states / noodles | 10 | 8 | 2 | 62.50% | 62.50% | 0.6250 |
| states / bread | 14 | 10 | 4 | 80.00% | 80.00% | 0.8000 |
| states / legumes | 26 | 20 | 6 | 75.00% | 70.00% | 0.7250 |
| states / eggs | 8 | 4 | 4 | 75.00% | 75.00% | 0.7500 |
| states / dairy | 36 | 19 | 17 | 84.21% | 84.21% | 0.8421 |
| states / fruit | 52 | 29 | 23 | 86.21% | 79.31% | 0.8218 |
| states / plant-milk | 8 | 3 | 5 | 100.00% | 66.67% | 0.8333 |
| states / vegetables | 58 | 45 | 13 | 73.33% | 73.33% | 0.7333 |
| states / roots | 18 | 16 | 2 | 75.00% | 75.00% | 0.7500 |
| states / nuts-seeds | 26 | 22 | 4 | 90.91% | 81.82% | 0.8636 |
| states / sauces | 22 | 7 | 15 | 85.71% | 85.71% | 0.8571 |
| states / sweeteners | 8 | 4 | 4 | 75.00% | 75.00% | 0.7500 |
| states / spices | 28 | 14 | 14 | 92.86% | 92.86% | 0.9286 |
| states / broth | 4 | 1 | 3 | 100.00% | 100.00% | 1.0000 |
| states / beverages | 12 | 6 | 6 | 100.00% | 100.00% | 1.0000 |
| states / grains | 24 | 16 | 8 | 81.25% | 81.25% | 0.8125 |
| states / desserts | 8 | 4 | 4 | 100.00% | 100.00% | 1.0000 |
| database / Milk and products | 18 | 18 | 0 | 100.00% | 100.00% | 1.0000 |
| database / Cereal and products | 46 | 46 | 0 | 100.00% | 100.00% | 1.0000 |
| database / Canned food | 43 | 42 | 1 | 100.00% | 100.00% | 1.0000 |
| database / Sugar, confectionery | 54 | 54 | 0 | 100.00% | 100.00% | 1.0000 |
| database / Condiments, traditional sauces | 46 | 46 | 0 | 100.00% | 100.00% | 1.0000 |
| database / Beverage and liquor | 31 | 31 | 0 | 100.00% | 100.00% | 1.0000 |
| database / Starchy root and products | 52 | 52 | 0 | 100.00% | 100.00% | 1.0000 |
| database / Pulses, nuts, seeds and products | 66 | 66 | 0 | 100.00% | 100.00% | 1.0000 |
| database / Vegetables | 251 | 250 | 1 | 100.00% | 100.00% | 1.0000 |
| database / Fruits | 111 | 110 | 1 | 98.18% | 98.18% | 0.9818 |
| database / Oil, lard, butter | 28 | 28 | 0 | 100.00% | 100.00% | 1.0000 |
| database / Meat and meat products | 161 | 158 | 3 | 100.00% | 100.00% | 1.0000 |
| database / Fish, shellfish and products | 113 | 108 | 5 | 100.00% | 100.00% | 1.0000 |
| database / Egg and products | 22 | 22 | 0 | 100.00% | 100.00% | 1.0000 |
| database / Milk and processed products | 10 | 10 | 0 | 0.00% | 0.00% | 0.0000 |
| database / Cereals and processed products | 20 | 20 | 0 | 0.00% | 0.00% | 0.0000 |
| database / Sweets (sugar, cakes, jams, candies) | 15 | 0 | 15 | — | — | — |
| database / Spices, sauces | 18 | 10 | 8 | 0.00% | 0.00% | 0.0000 |
| database / Soft drinks | 9 | 6 | 3 | 0.00% | 0.00% | 0.0000 |
| database / Traditional food | 81 | 78 | 3 | 0.00% | 0.00% | 0.0000 |
| database / Tubers and processed products | 22 | 22 | 0 | 0.00% | 0.00% | 0.0000 |
| database / Seeds, fruits rich in protein, fat and processed products | 21 | 20 | 1 | 0.00% | 0.00% | 0.0000 |
| database / Vegetables, fruits, tubers used as vegetables | 93 | 90 | 3 | 0.00% | 0.00% | 0.0000 |
| database / Ripe fruit | 5 | 4 | 1 | 0.00% | 0.00% | 0.0000 |
| database / Oil, fat, butter | 2 | 2 | 0 | 0.00% | 0.00% | 0.0000 |
| database / Meat and processed products | 117 | 112 | 5 | 0.00% | 0.00% | 0.0000 |
| database / Seafood and processed products | 56 | 52 | 4 | 0.00% | 0.00% | 0.0000 |
| database / Eggs and processed products | 1 | 0 | 1 | — | — | — |
| database / Packaged product | 23 | 23 | 0 | 0.00% | 0.00% | 0.0000 |
| database / Pork Products | 662 | 662 | 0 | 99.70% | 90.63% | 0.9494 |
| database / Dairy and Egg Products | 524 | 524 | 0 | 100.00% | 98.66% | 0.9930 |
| database / Vegetables and Vegetable Products | 1567 | 1567 | 0 | 99.62% | 94.96% | 0.9726 |
| database / Vegetable and products | 4 | 4 | 0 | 100.00% | 100.00% | 1.0000 |
| database / Nut and Seed Products | 274 | 274 | 0 | 100.00% | 97.45% | 0.9872 |
| database / Beef Products | 1141 | 1141 | 0 | 97.37% | 70.03% | 0.8282 |
| database / Sausages and Luncheon Meats | 12 | 12 | 0 | 100.00% | 100.00% | 1.0000 |
| database / Beverages | 710 | 710 | 0 | 100.00% | 98.73% | 0.9937 |
| database / Finfish and Shellfish Products | 516 | 516 | 0 | 99.81% | 97.29% | 0.9845 |
| database / Legumes and Legume Products | 543 | 543 | 0 | 100.00% | 96.87% | 0.9840 |
| database / Lamb, Veal, and Game Products | 928 | 928 | 0 | 99.78% | 92.35% | 0.9598 |
| database / Baked Products | 848 | 848 | 0 | 100.00% | 98.23% | 0.9912 |
| database / Sweets | 638 | 638 | 0 | 100.00% | 98.75% | 0.9935 |
| database / Other | 204 | 204 | 0 | 100.00% | 99.02% | 0.9951 |
| database / Cereal Grains and Pasta | 360 | 360 | 0 | 100.00% | 98.61% | 0.9931 |
| database / Spices and Herbs | 126 | 126 | 0 | 99.21% | 93.65% | 0.9630 |

## Global scenarios by cuisine/context

| Group | Executed | Scorable | No gold | Recall@3 | Rank-one | MRR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Afghanistan | 2 | 2 | 0 | 100.00% | 100.00% | 1.0000 |
| Algeria | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |
| Argentina | 2 | 2 | 0 | 100.00% | 100.00% | 1.0000 |
| Australia | 2 | 1 | 1 | 100.00% | 100.00% | 1.0000 |
| Austria | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |
| Bangladesh | 2 | 1 | 1 | 100.00% | 100.00% | 1.0000 |
| Belgium | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |
| Brazil | 4 | 4 | 0 | 100.00% | 75.00% | 0.8333 |
| Cambodia | 2 | 2 | 0 | 100.00% | 50.00% | 0.7500 |
| Canada | 3 | 3 | 0 | 100.00% | 100.00% | 1.0000 |
| Chile | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |
| China | 8 | 7 | 1 | 85.71% | 85.71% | 0.8571 |
| Colombia | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |
| Cuba | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |
| Denmark | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |
| Dominican Republic | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |
| Ecuador | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |
| Egypt | 3 | 3 | 0 | 100.00% | 100.00% | 1.0000 |
| Eritrea | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |
| Ethiopia | 3 | 3 | 0 | 100.00% | 100.00% | 1.0000 |
| Fiji | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |
| Finland | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |
| France | 8 | 7 | 1 | 100.00% | 100.00% | 1.0000 |
| Germany | 5 | 5 | 0 | 100.00% | 100.00% | 1.0000 |
| Ghana | 2 | 2 | 0 | 100.00% | 100.00% | 1.0000 |
| Greece | 4 | 4 | 0 | 100.00% | 100.00% | 1.0000 |
| Haiti | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |
| Hungary | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |
| Iceland | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |
| India | 17 | 16 | 1 | 93.75% | 87.50% | 0.9063 |
| Indonesia | 5 | 4 | 1 | 100.00% | 100.00% | 1.0000 |
| Iran | 3 | 2 | 1 | 100.00% | 100.00% | 1.0000 |
| Iraq | 1 | 0 | 1 | — | — | — |
| Ireland | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |
| Israel | 2 | 2 | 0 | 100.00% | 100.00% | 1.0000 |
| Italy | 14 | 14 | 0 | 100.00% | 100.00% | 1.0000 |
| Jamaica | 2 | 2 | 0 | 100.00% | 100.00% | 1.0000 |
| Japan | 16 | 14 | 2 | 100.00% | 100.00% | 1.0000 |
| Kenya | 2 | 2 | 0 | 100.00% | 100.00% | 1.0000 |
| Korea | 7 | 6 | 1 | 100.00% | 100.00% | 1.0000 |
| Laos | 2 | 2 | 0 | 100.00% | 100.00% | 1.0000 |
| Lebanon | 6 | 6 | 0 | 100.00% | 100.00% | 1.0000 |
| Madagascar | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |
| Malaysia | 2 | 1 | 1 | 100.00% | 0.00% | 0.5000 |
| Mexico | 12 | 12 | 0 | 100.00% | 100.00% | 1.0000 |
| Morocco | 4 | 3 | 1 | 100.00% | 100.00% | 1.0000 |
| Myanmar | 2 | 2 | 0 | 100.00% | 100.00% | 1.0000 |
| Nepal | 2 | 2 | 0 | 100.00% | 100.00% | 1.0000 |
| Netherlands | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |
| New Zealand | 2 | 2 | 0 | 100.00% | 100.00% | 1.0000 |
| Nigeria | 4 | 4 | 0 | 100.00% | 100.00% | 1.0000 |
| Norway | 2 | 2 | 0 | 100.00% | 50.00% | 0.7500 |
| Pakistan | 2 | 2 | 0 | 100.00% | 100.00% | 1.0000 |
| Peru | 4 | 4 | 0 | 100.00% | 100.00% | 1.0000 |
| Philippines | 3 | 3 | 0 | 66.67% | 66.67% | 0.6667 |
| Poland | 2 | 2 | 0 | 100.00% | 100.00% | 1.0000 |
| Portugal | 2 | 2 | 0 | 100.00% | 100.00% | 1.0000 |
| Puerto Rico | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |
| Romania | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |
| Russia | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |
| Samoa | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |
| Saudi Arabia | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |
| Senegal | 2 | 2 | 0 | 100.00% | 100.00% | 1.0000 |
| Singapore | 2 | 2 | 0 | 100.00% | 100.00% | 1.0000 |
| South Africa | 2 | 2 | 0 | 100.00% | 100.00% | 1.0000 |
| Spain | 4 | 4 | 0 | 100.00% | 100.00% | 1.0000 |
| Sri Lanka | 2 | 2 | 0 | 100.00% | 100.00% | 1.0000 |
| Sweden | 2 | 1 | 1 | 0.00% | 0.00% | 0.0000 |
| Switzerland | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |
| Syria | 2 | 2 | 0 | 100.00% | 50.00% | 0.7500 |
| Taiwan | 2 | 2 | 0 | 100.00% | 100.00% | 1.0000 |
| Tanzania | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |
| Thailand | 8 | 7 | 1 | 85.71% | 85.71% | 0.8571 |
| Tunisia | 1 | 0 | 1 | — | — | — |
| Turkey | 4 | 4 | 0 | 100.00% | 100.00% | 1.0000 |
| Ukraine | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |
| United Kingdom | 4 | 4 | 0 | 100.00% | 75.00% | 0.8750 |
| United States | 30 | 30 | 0 | 96.67% | 86.67% | 0.9056 |
| Venezuela | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |
| Vietnam | 77 | 75 | 2 | 88.00% | 85.33% | 0.8667 |
| Yemen | 1 | 1 | 0 | 100.00% | 100.00% | 1.0000 |

## Failure examples

### Empty candidate pool

| Case | Query | Candidate descriptions |
| --- | --- | --- |
| cn-bok-choy | bok choy | (empty) |
| world-th-galangal | galangal | (empty) |
| world-ph-rice-vinegar | rice vinegar | (empty) |
| world-in-urad | black gram | (empty) |

### Nonempty pool entirely outside explicit target state

| Case | Query | Candidate descriptions |
| --- | --- | --- |
| vn-trau | Thịt trâu thăn | fao_vn_2007_7027_raw: Buffalo meat, lean (loin) |
| vn-bo-than--cooked-weight | Thăn nội bò | usda_13923_raw: Beef, tenderloin, steak, separable lean and fat, trimmed to 1/8" fat, select, raw; usda_13917_raw: Beef, tenderloin, steak, separable lean and fat, trimmed to 1/8" fat, all grades, raw; usda_23368_raw: Beef, loin, tenderloin roast, boneless, separable lean only, trimmed to 0" fat, select, raw |
| fr-filet-mignon--cooked-weight | beef tenderloin | usda_23583_raw: Beef, tenderloin, steak, separable lean only, trimmed to 1/8" fat, select, raw; usda_23367_raw: Beef, loin, tenderloin roast, boneless, separable lean only, trimmed to 0" fat, choice, raw; usda_13926_raw: Beef, tenderloin, separable lean and fat, trimmed to 1/8" fat, prime, raw |
| ar-flank--cooked-weight | beef flank steak | usda_23657_raw: Beef, flank, steak, separable lean only, trimmed to 0" fat, select, raw; usda_13971_raw: Beef, flank, steak, separable lean and fat, trimmed to 0" fat, select, raw; usda_13068_raw: Beef, flank, steak, separable lean only, trimmed to 0" fat, choice, raw |

### Exact shortcut misses accepted identity/state

| Case | Query | Candidate descriptions |
| --- | --- | --- |
| vn-trau | Thịt trâu thăn | fao_vn_2007_7027_raw: Buffalo meat, lean (loin) |
| vn-taro | Khoai môn | fao_vn_2007_2010_raw: Chinese Yam, spiny yam |
| vn-gan-ga--cooked-weight | Gan gà | fao_vn_2007_7040_raw: Chicken liver |
| vn-muc--cooked-weight | Mực tươi | fao_vn_2007_8040_raw: Cuttle fish, raw (Squid) |

### Accepted gold exclusively NIN or OFF

| Case | Query | Candidate descriptions |
| --- | --- | --- |
| vn-trau | Thịt trâu thăn | fao_vn_2007_7027_raw: Buffalo meat, lean (loin) |
| vn-mi-goi--cooked-weight | Mì ăn liền | usda_6583_raw: Soup, ramen noodle, any flavor, dry; usda_6982_raw: Soup, ramen noodle, beef flavor, dry; usda_8366_raw: Cereals ready-to-eat, SUN COUNTRY, KRETSCHMER Wheat Germ, Regular |
| ng-cassava--cooked-weight | cassava | usda_11134_raw: Cassava, raw; fao_vn_2007_2020_raw: Cassava flour; fao_vn_2007_2004_raw: Bitter cassava |
| vn-chuoi--cooked-weight | Banana | fao_vn_2007_5006_raw: Banana |

### Enhanced candidate absent from every accepted gold row

| Case | Query | Candidate descriptions |
| --- | --- | --- |
| us-turkey | turkey breast | usda_5293_cooked: Turkey breast, pre-basted, meat and skin, cooked, roasted; usda_7081_raw: Turkey breast, sliced, prepackaged; usda_5718_cooked: Turkey, breast, from whole bird, meat only, with added solution, roasted |
| us-skinless-thigh--cooked-weight | chicken thigh meat only | usda_5119_raw: Chicken, roasting, dark meat, meat only, raw; usda_5682_raw: Chicken, dark meat, thigh, meat only, with added solution, raw; usda_5096_raw: Chicken, broilers or fryers, dark meat, thigh, meat only, raw |
| us-skin-on-thigh--cooked-weight | chicken thigh meat and skin | usda_5691_raw: Chicken, dark meat, thigh, meat and skin, with added solution, raw; usda_5674_raw: Chicken, skin (drumsticks and thighs), raw; usda_5091_raw: Chicken, broilers or fryers, thigh, meat and skin, raw |
| us-turkey--cooked-weight | turkey breast | usda_5293_cooked: Turkey breast, pre-basted, meat and skin, cooked, roasted; usda_5718_cooked: Turkey, breast, from whole bird, meat only, with added solution, roasted |

## Audit and limits

- Frozen fixture, snapshot and manifest fingerprints match; manifest fingerprint: `2a84ad0baf9dcc115f18f1390969666f99aaadcdd4e80c8aca72a7d4ace61e33`.
- Every one of the 11456 completed IDs occurs exactly once and belongs to the planned corpus. Stored query contexts, gold sets, candidate rows and ranking scores passed the completed-prefix auditor.
- No missing embedding was replaced with lexical-only matching. This analysis neither changes the worker checkpoint nor submits fresh requests.
- Alias scores are unavailable, not zero. Ambiguous aliases can name multiple cuts, states or enhanced products; future alias scores must be reported as reachability diagnostics.
- Call 1, Call 2, final selected row, edible portions and final macro accuracy remain unscored. A natural-meal decomposition-to-retrieval evaluation is a separate follow-up.
- Three key projects were independently verified unbilled; the remaining projects rely on the explicit human confirmation when metadata access returned 403. Invalid key 7 stays administratively excluded. Billing guards remain in the worker.
- The full 35,122-case report remains pending and must still pass its separate completion audit.

Local evidence, retained in the matching-audit worktree and excluded from this
report-only PR: `scripts/eval/reports/matching-all-keypool/{manifest.json,status.json,snapshot.json,observations.jsonl}`
and `/tmp/kallo-workaround-prefix-audit.log`. The evaluation harness and raw
artifacts are not part of this PR, so this report alone cannot reproduce the run.
