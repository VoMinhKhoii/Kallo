-- Phase A.6: add per-substage fire-rate signals to pipeline_runs.
--
-- These columns let the harness compute aggregate misfire / fallback rates
-- by category, distinguishing the existing `retry_count` (which conflates
-- language retries with parse / step-2 retries) from the language guard
-- specifically. `alias_fallback_fired` is set when the matching cascade
-- enters Phase 3b regardless of rescue outcome.

ALTER TABLE pipeline_runs
  ADD COLUMN language_guard_misfire boolean NOT NULL DEFAULT false,
  ADD COLUMN language_retry_count smallint NOT NULL DEFAULT 0,
  ADD COLUMN alias_fallback_fired boolean NOT NULL DEFAULT false;

CREATE INDEX pipeline_runs_language_guard_misfire_idx
  ON pipeline_runs (language_guard_misfire)
  WHERE language_guard_misfire = true;

CREATE INDEX pipeline_runs_alias_fallback_fired_idx
  ON pipeline_runs (alias_fallback_fired)
  WHERE alias_fallback_fired = true;
