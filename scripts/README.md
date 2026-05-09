# Scripts

## KPI rollups

`eval-kpis.sql` contains manually-run KPI rollups over `pipeline_runs` for the
AI pipeline evaluation flywheel. Each block is independently re-runnable, uses
7-day rolling windows by default, and is intended to be pasted into psql,
Drizzle Studio, or the Supabase SQL Editor for visible-when-reviewed analysis.
