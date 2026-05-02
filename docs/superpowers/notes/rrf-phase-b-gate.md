# RRF Phase B Gate (§2.4)

Phase A logs **scalar disagreement metrics** on a sample of meals. It does
NOT persist the per-ingredient candidate lists — those are computed in-memory
during a sampled request and dropped after the disagreement flag is captured.
Phase B, shipping RRF as the v1 default, requires:

1. **Disagreement rate.** `rrf_disagreement_count / rrf_ingredients_observed`
   averaged over a 7-day window with at least 1,000 sampled meals. If this rate
   is below 5%, RRF cannot meaningfully change outcomes — defer.
2. **Precision lift on changed matches.** Cross-reference the disagreement set
   against the eval suite's labeled ground truth from Chunk 4 §5. If the
   changed-match precision delta is below 2 percentage points, defer.
3. **Latency budget.** `p95(rrf_measurement_latency_ms)` must be below 30% of
   current p95 match latency. If parallel fuzzy meaningfully degrades the
   cascade, defer or scope down, for example fuzzy only when vector confidence
   is below threshold.

When all three pass, Phase B is a separate plan that must include:

- **Candidate persistence:** a new `pipeline_run_rrf_samples` table, or a
  `pipeline_runs.rrf_candidates` JSONB column, holding
  `[{ ingredientName, vectorTop[], fuzzyTop[] }]` for every sampled run. Current
  scalar metrics are sufficient to gate the decision, but RRF score computation
  needs candidate ranks.
- **Score formula:** implement RRF compute
  (`score(d) = Σ 1 / (k + rank_i(d))` across the two candidate lists, typical
  `k=60`).
- **Routing change:** modify source selection to fuse candidate lists and pick
  the top RRF-scored entry rather than the top-similarity entry.
- **Ramp:** reuse the same `RRF_MEASUREMENT_ENABLED` flag with a new
  `RRF_PRODUCTION_MODE=fuse` mode. Default `measure-only` preserves Phase A
  behavior.

Until all three Phase A gates pass, keep Phase A logging on at a low sample rate
of 5% or less so the dataset keeps growing.
