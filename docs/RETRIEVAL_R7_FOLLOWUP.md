# R7 retrieval follow-up

Date: 2026-08-12

## Recommendation

Ship R7 as measured. Treat the remaining work as two separate programs:

1. add genuinely absent Vietnamese foods, led by a commercial-use agreement
   with Vietnam's National Institute of Nutrition (NIN) and, in parallel, a
   clearly marked recipe-derived layer for prepared dishes;
2. improve ranking with language- and intent-aware strategies, beginning with
   the already-measured English-only R6 route and tone restoration for untoned
   Vietnamese.

Do not spend another cycle changing the global length tie-break or the primary
name bonus. R1 and R2 both regressed, and vector-only R5 was catastrophic.

## DB enrichment sources

### 1. NIN 2017 table and underlying analytical tables — pursue first

The Ministry of Health/NIN 2017 Vietnamese Food Composition Table is the best
institutional fit. FAO's catalogue describes it as a 302-page, print-only NIN
publication. A Vietnamese library record describes a 2017 common-nutrients
edition with values per 100 g edible food. It is newer than the 526-row 2007
table already loaded as `fao_vn_2007_*`.

- **Gap coverage:** potentially the highest for Vietnamese ingredients and
  prepared components, but row-level coverage cannot be verified from the
  public catalogue. Access to the book or an export is required before making
  a numerical coverage claim. Request an inventory explicitly covering the 72
  diacritic-folded gap strings, especially bánh canh, bánh cuốn, bánh hỏi, bánh
  ướt, bún bò, cá kho, canh chua, chà bông, chả cốm, chả giò, giò/chả lụa,
  gà luộc, heo quay, nem, riêu cua, xá xíu, and Vietnamese meat cuts.
- **Rights:** no open commercial-data licence is published. The table is a
  copyrighted print publication. Commercial ingestion therefore requires a
  written data licence from NIN/Ministry of Health/Medical Publishing House;
  buying the book is not a redistribution licence.
- **Quality/basis:** national food-composition-table quality, with values per
  100 g edible portion. Obtain value-level provenance because updated tables
  can combine laboratory values, borrowed values, and calculated values.
- **Format/effort:** print-only according to FAO; expect OCR/table extraction,
  a source-code crosswalk, nutrient-definition normalization, and manual QA.
- **Refuse:** likely the strongest Vietnamese route, but the exact 2017 field
  must be confirmed contractually and in a sample export. Require both edible
  portion/refuse percentage and refuse description in the data request.

Sources: [FAO catalogue entry](https://www.fao.org/food-composition/tables-and-databases/detail/%28viet-nam--2017%29-vietnamese-food-composition-table/en),
[Vietnamese library record](https://www.emiclib.com/Item/ItemDetail/1554082).

### 2. NIN analytical studies — targeted, high-quality supplements

NIN published a 2007 study of 27 traditional Vietnamese foods. It reports 15
laboratory indicators per 100 g using TCVN, AOAC, FAO, and ISO methods and
explicitly includes bánh cuốn. This is direct evidence for one important gap
and may cover more rice/flour foods once the full table is obtained.

- **Gap coverage:** bánh cuốn confirmed; the abstract groups 27 rice,
  glutinous-rice, flour, peanut, millet, mung-bean, and sugar products but does
  not expose the full value table. Other academic studies should only be added
  when their sampled food exactly matches a gap.
- **Rights:** the facts may not be copyrightable in every jurisdiction, but the
  article/table and any dataset have no published commercial reuse licence.
  Obtain permission or the authors' underlying machine-readable results.
- **Quality/basis:** laboratory-analysed and per 100 g; stronger than a web
  recipe or label. Sampling may be small and regional, so preserve sample,
  method, location, and year metadata.
- **Format/effort:** article tables/manual extraction; medium effort and high
  QA. No API.
- **Refuse:** not reported in the public abstract. Treat it as absent unless
  the full study supplies it.

Source: [NIN study abstract](https://viendinhduong.vn/en/lookup/de-tai-nghien-cuu-khoa-hoc/thanh-phan-dinh-duong-mot-so-thuc-an-truyen-thong-viet-nam-68035cf4359ef722321fcd6c).

### 3. Recipe composition — build in parallel

Recipe composition is the fastest reliable way to cover prepared dishes whose
ingredients already exist. It should be a separate provenance tier, never
presented as laboratory analysis.

- **Gap coverage:** high for bánh bao trứng muối, bánh canh, bánh cuốn, bánh
  hỏi, bánh ướt, bún bò, cá kho, canh chua, chả cốm, chả giò tôm, gà luộc,
  heo quay, mọc viên, nem lụi, nem rán, nước dùng phở/Thái, riêu cua, thịt xá
  xíu, tỏi/hành phi, tôm viên, and vỏ bánh bao. It is unsuitable for unknown
  branded formulations and weak for simple absent species/cuts that need a
  direct analytical match.
- **Rights:** internally authored recipes and calculations can be used
  commercially. Source recipes must be licensed, commissioned, or reduced to
  independently validated ingredient/yield facts; do not copy copyrighted
  prose or a proprietary recipe database.
- **Quality/basis:** recipe-derived. Use multiple representative Vietnamese
  recipes, ingredient-level nutrient values, edible weights, cooking yield,
  and nutrient retention factors. Store a range across recipes, plus a chosen
  midpoint, instead of false single-value precision.
- **Format/effort:** structured JSON is straightforward, but food matching,
  yield measurement, and review by a Vietnamese dietitian are meaningful work.
  Version the recipe, ingredient mappings, yield, retention-factor source, and
  calculation code.
- **Refuse:** yes, if calculated deliberately. Convert as-purchased ingredient
  weights to edible weights using each ingredient's refuse factor before the
  recipe calculation; record both recipe-level purchased and edible yields.

FAO/INFOODS says recipe calculation is preferable to borrowing a merely
similar cooked food and calls for appropriate yield and nutrient-retention
factors. EuroFIR documents the same calculation method. A Vietnamese dietary
study also reports using component recipes for mixed dishes absent from the
Vietnamese FCT, showing this is established practice rather than a workaround.

Sources: [FAO/INFOODS food-matching guideline](https://www.fao.org/fileadmin/templates/food_composition/documents/Nutrition_assessment/INFOODSGuidelinesforFoodMatching_version_1_2.pdf),
[EuroFIR recipe guideline](https://eurofir.eu/bacchus/wp-content/uploads/2015/12/EUROFIR-RECIPE-GUIDELINE_FINAL.pdf),
[Vietnamese dietary-study method](https://res.mdpi.com/d_attachment/nutrients/nutrients-12-03335/article_deploy/nutrients-12-03335-v2.pdf).

### 4. Open Food Facts — use only as a segregated branded source

- **Gap coverage:** best for packaged gaps such as Pepsi, Pepsi chanh không
  calo, yoghurt nha đam, sữa tươi ít đường, curry/bò-kho seasonings, matcha,
  and packaged meatballs/char siu. Poor for unbranded Vietnamese street dishes.
  The current DB only contains products cached through barcode lookup, so a
  current Vietnam export could add coverage that the present `off_*` rows lack.
- **Rights:** commercial reuse is allowed under ODbL, but attribution and
  share-alike obligations apply to an adapted database. Keep OFF logically and
  operationally separable, and obtain legal review before mixing its rows into
  a proprietary combined export.
- **Quality/basis:** crowd-contributed package-label values, normally per 100 g
  or 100 ml; not laboratory analysis and explicitly not guaranteed accurate or
  complete. Retain barcode, brand, country, last-modified time, completeness,
  and label image/provenance.
- **Format/effort:** API plus bulk CSV/JSONL exports; low-to-medium ingestion
  effort, with aggressive validation and deduplication.
- **Refuse:** no useful edible-portion/refuse field. Packaged foods generally
  assume the product as consumed, so this source does not solve meat/bone waste.

Source: [official API and licence documentation](https://openfoodfacts.github.io/openfoodfacts-server/api/).

### 5. ASEANFOODS — do not ingest as the next source

The 2014 ASEAN database has 616 records compiled from six national tables. Its
PDF contains regional foods and Thai mixed dishes, but a text search finds no
`Banh`, and its own limitations section says country-specific indigenous foods
were excluded. It therefore misses the main reason enrichment is needed.

- **Gap coverage:** negligible direct coverage of the Vietnamese prepared-dish
  gaps; possible analogues (rice noodles, meatballs, soups) are not exact foods.
- **Rights:** non-commercial use is free; commercial reproduction may incur
  fees and requires contacting Mahidol/ASEANFOODS. It is not an open commercial
  dataset.
- **Quality/basis:** systematically compiled averages, per 100 g edible portion
  (or per 100 ml for some Thai liquids), from laboratory data and published or
  unpublished national sources. The publisher warns that value-level quality
  cannot always be assessed and that micronutrients are incomplete.
- **Format/effort:** 87-page electronic PDF, not a clean machine-readable
  export; medium/high extraction effort.
- **Refuse:** the concise table does not carry percent edible/refuse. It says
  that detail is only available in the underlying Malaysian and Philippine
  national tables, so it does not meet the refuse requirement.

Source: [official ASEANFOODS PDF](https://inmu.mahidol.ac.th/aseanfoods/doc/OnlineASEAN_FCD_V1_2014.pdf).

### 6. Other FAO/INFOODS regional datasets — reference, not bulk enrichment

FAO/INFOODS is useful for standards and source discovery. The relevant Vietnam
and ASEAN tables are either already present, print-only, redundant, or weak on
the exact gaps. FAO's current statistical-database terms default to CC BY 4.0
but add a prohibition on using datasets in promotion of a commercial enterprise
and warn that third-party data may have different rights. That is not clean
enough for unreviewed commercial ingestion.

- **Gap coverage:** low incremental direct coverage; use for exact regional
  analogues only after food-matching review.
- **Rights:** dataset-by-dataset legal review and third-party clearance needed.
- **Quality/basis:** heterogeneous compiled and analytical data, generally per
  100 g edible portion.
- **Format/effort:** ranges from spreadsheets to PDFs; medium normalization.
- **Refuse:** dataset-specific; never infer it merely from “per 100 g edible.”

Sources: [FAO statistical database terms](https://www.fao.org/contact-us/terms/db-terms-of-use/en),
[FAO/INFOODS standards](https://www.fao.org/infoods/infoods/standards-guidelines/en/).

## R7 mis-ranking analysis

### Method

For each of 519 queries, all unique candidates from all eight strategy pools
were collected. A case entered this analysis when at least one pooled candidate
had a double-judged rating of 2 and R7's rank 1 was not rated 2. There are 120
such cases. Each was assigned one primary cause so the counts below are
exclusive and sum to 120. Cross-cutting source effects are reported separately.

| Primary cause | Cases | Total-query headroom | What failed |
| --- | ---: | ---: | --- |
| Untoned/orthography | 27 | 5.20 pp | The untoned query fails while its toned twin is R7-correct |
| Lexical collision/compound boundary | 23 | 4.43 pp | A query is a saturated substring of a wrong compound or homograph |
| Generic vs specific/modifier | 23 | 4.43 pp | Correct family, wrong preparation/product/modifier specificity |
| English queries | 19 | 3.66 pp | R7 underuses the deeper vector rerank that helped English |
| Cut/species/entity confusion | 11 | 2.12 pp | Wrong animal cut, species, vegetable, or ingredient identity |
| Raw/cooked/preparation state | 10 | 1.93 pp | Correct food exists, but the opposite state ranks first |
| Ambiguous/noisy judgement intent | 6 | 1.16 pp | The rating-2 candidate reflects another plausible fold or is visibly not the intended food |
| Brand token suppresses generic match | 1 | 0.19 pp | `bentagen dâu` retrieves nothing although strawberry is pooled |

The total 23.12 pp is the gap from R7's 56.84% to the 79.96% pooled ceiling.

Cross-cutting observations (not additive):

- 31/120 rank-1 rows come from a source that has no rating-2 row in that query's
  pooled set: 21 USDA-over-FAO and 10 FAO-over-USDA. Source competition matters,
  but a global source preference would be unsafe.
- Brand/processed rank-1 noise is not the main residual problem: only one case
  has brand tokens as its primary cause, consistent with R7's 2.12% overall
  branded/processed rank-1 rate.
- Six cases should be adjudicated before optimizing against them: `bun lut`,
  `cha com`, `oc huong`, `toi phi`, `tré`, and `xa xiu`. Their pooled rating-2
  rows include Uncle Ben's rice, European anchovy, pig brain, tilapia, catfish,
  and root beer respectively; several reflect an alternate untoned reading,
  not the apparent gap food.

### Exhaustive query assignment

- **Untoned/orthography (27):** `bap cai`, `ca phe`, `ca rot`, `canh ga`,
  `dau ve`, `du du`, `hat sen`, `hu tiu`, `mi`, `mu tat`, `nuoc dua`,
  `nuoc dua tuoi`, `ot`, `sa`, `sot ca chua`, `sua chua`, `sua hat`,
  `sua nguyen chat`, `sup lo`, `thit bo`, `thit ga`, `thit lon`, `thit nac`,
  `thit quay`, `tom`, `trung ga ta`, `vo banh tortilla`.
- **Lexical collision/compound boundary (23):** `banh hu tieu`,
  `bánh hủ tiếu`, `banh mi sandwich`, `bánh mì sandwich`, `banh trang`,
  `bắp bò`, `bột chiên`, `chả lụa`, `dau phu`, `đậu hũ`, `đậu phụ`,
  `kem`, `mì ý`, `ngô`, `phô mai`, `rau salad`, `sua`, `sữa`,
  `thit nuong`, `thịt nướng`, `thơm`, `tim`, `tre`.
- **Generic vs specific/modifier (23):** `banh mi`, `bánh mì`,
  `banh mi gao luc`, `bánh mì gạo lức`, `bánh tráng`, `bột cacao`,
  `chả bò`, `dâu`, `dừa`, `mi y`, `nhân thịt`, `nước chấm`, `rau má`,
  `riêu cua`, `sua tuoi`, `thit bam`, `thịt băm`, `thit heo`, `thịt heo`,
  `thit heo bam`, `thit vien`, `thịt viên`, `trứng nhỏ`.
- **English (19):** `beef`, `chicken`, `coconut milk`, `cream`, `duck`, `egg`,
  `flour coating`, `foie gras`, `milk`, `mushrooms`, `potatoes`, `prime rib`,
  `rice`, `shrimp`, `tomatoes`, `water`, `whey`, `yoghurt`, `yogurt`.
- **Cut/species/entity (11):** `bột năng`, `cải xanh`, `dau xanh`,
  `nạm bò`, `rau cai`, `rau cải`, `sườn non`, `thit cua`, `thịt cua`,
  `thit lon bam`, `thịt nạm bò`.
- **Raw/cooked/preparation state (10):** `cải ngọt`, `cơm gạo lứt`,
  `đậu xanh`, `đùi gà`, `giá đỗ`, `hủ tiếu`, `táo`, `thịt bò băm`,
  `thịt heo bằm`, `thịt lợn băm`.
- **Ambiguous/noisy judgement intent (6):** `bun lut`, `cha com`, `oc huong`,
  `toi phi`, `tré`, `xa xiu`.
- **Brand token (1):** `bentagen dâu`.

## Next ranking strategies, in test order

1. **Language-gated R6 for English, R7 otherwise.** This is already measurable
   from the bake-off: English top-1 rises from R7's 55.74% to R6's 67.21% and
   English disasters fall from 16.39% to 8.20%, while Vietnamese stays on R7.
   The composed result would be 302/519 = **58.19% top-1** and approximately
   **20.04% disasters**, before any new retrieval idea. Add it as a composed
   strategy, not a global switch to R6.
2. **Restore Vietnamese tones before the vector arm.** Add a harness strategy
   that generates/ranks diacritized query variants from the DB vocabulary, then
   runs normal R7 for the best variant. First add an oracle-toned-twin upper
   bound; the 27 observed twin recoveries cap this idea at +5.20 pp. Do not
   loosen similarity thresholds.
3. **Bidirectional field match after RRF.** Preserve R4 recall and RRF, then use
   a small rerank feature combining `word_similarity(query, field)` with full
   field similarity/token precision. This penalizes cases where the query is
   merely embedded in `kẹo sữa`, `bánh mì phô mai`, or `nước sốt thịt nướng`.
   Grid-search the weight in the harness and retain disaster rate as a gate.
4. **State prior only for unqualified base foods.** When the query has no cooked,
   fried, dried, canned, or branded modifier, test a small raw/unprocessed prior;
   when it has a preparation token, require state agreement. Maximum observed
   primary headroom is 10 cases, and state-annotated queries must be scored
   separately to catch regressions.
5. **Negative modifier/entity features.** Tokenize candidate fields into food
   entity, species/cut, preparation, and brand modifiers. Penalize an unmatched
   conflicting head entity (`bò` vs `lợn`, `cua` vs `surimi`, `cải xanh` vs
   `bắp cải`) more than harmless detail. Start with a small curated lexicon in
   the harness; only promote it if the 11 entity cases improve without reducing
   generic-query accuracy.
6. **Source-aware agreement, not a fixed FAO preference.** Test an RRF bonus
   when lexical and vector arms agree on the same source/row and an exact-field
   token match exists. Report the 31 cross-source cases in both directions. A
   blanket FAO-first policy is not supported by the data.

R1 (remove length tie-break), R2 (remove primary bonus alone), and R5
(vector-only) are excluded from further consideration because the bake-off has
already falsified them.
