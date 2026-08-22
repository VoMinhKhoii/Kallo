# Scripts

One concern per folder. Nothing lives at this top level except this file.

| Folder | Concern |
| --- | --- |
| `_lib/` | shared helpers for the scripts themselves (`runtime.ts`) |
| `assets/` | brand/PWA asset generation (splash mark, icons) |
| `bench/` | latency harness and the KPI/baseline SQL rollups |
| `ci/` | gates run by GitHub Actions (migrations, structure, security report) |
| `cloud-run/` | Cloud Run deploy plumbing, smoke checks, staging lease |
| `data/` | one-off data pipelines: `usda/`, `vtn_fct/`, `translate-usda-vietnamese/` |
| `db/` | database backfills and coverage probes run against a live DB |
| `dev/` | local developer conveniences (worktree env links, live OCR probe) |
| `enrich/` | NIN food enrichment ingestion |
| `eval/` | the AI pipeline eval harness; `eval/local/` holds throwaway probes |
| `ops/` | scheduled/manual production operations (deletions, webhook upkeep) |

Tests sit in a `__tests__/` folder next to the code they cover.

## KPI rollups

`bench/eval-kpis.sql` contains manually-run KPI rollups over `pipeline_runs`
for the AI pipeline evaluation flywheel. Each block is independently
re-runnable, uses 7-day rolling windows by default, and is intended to be
pasted into psql, Drizzle Studio, or the Supabase SQL Editor for
visible-when-reviewed analysis. `bench/baseline-queries.sql` holds the
before/after baseline queries those rollups are compared against.
