import { readFileSync } from 'node:fs';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
  analysisGuardEvents,
  analysisModelBudgetEvents,
  pipelineLlmCalls,
  pipelineRequestReplayAuditLogs,
  pipelineRequests,
  synonymCandidates,
  unmatchedIngredients,
} from '@/lib/infra/db/schema';

const migration = readFileSync(
  'supabase/migrations/20261015183834_trace_retention_and_request_summaries.sql',
  'utf8'
);

describe('trace storage expand contract (no database connection)', () => {
  it('keeps all summary columns nullable for old rows/revisions', () => {
    const columns = getTableConfig(pipelineRequests).columns;
    for (const name of [
      'meal_name',
      'model_profile',
      'models',
      'calories_kcal',
      'protein_g',
      'carbohydrate_g',
      'fat_g',
      'item_count',
      'error_code',
      'trace_logged',
    ]) {
      expect(columns.find((column) => column.name === name)?.notNull).toBe(
        false
      );
    }
    expect(pipelineLlmCalls.promptRendered.notNull).toBe(false);
  });

  it('provides a created_at-leading index for every new reaper that needs one', () => {
    for (const table of [
      analysisGuardEvents,
      analysisModelBudgetEvents,
      pipelineRequestReplayAuditLogs,
      synonymCandidates,
      unmatchedIngredients,
    ]) {
      expect(
        getTableConfig(table).indexes.some(
          (index) =>
            'name' in index.config.columns[0] &&
            index.config.columns[0].name === 'created_at'
        )
      ).toBe(true);
    }
    // pipeline_runs has a manual index predating Drizzle's current snapshot.
    expect(
      readFileSync(
        'supabase/migrations/20260430201542_pipeline_runs_rls.sql',
        'utf8'
      )
    ).toMatch(
      /idx_pipeline_runs_created_at\s+ON public.pipeline_runs\s*\(created_at/i
    );
  });

  it('declares the six retention windows and bounds each invocation', () => {
    for (const [table, days] of [
      ['analysis_model_budget_events', 181],
      ['pipeline_runs', 181],
      ['analysis_guard_events', 30],
      ['unmatched_ingredients', 90],
      ['synonym_candidates', 90],
      ['pipeline_request_replay_audit_logs', 181],
    ]) {
      expect(migration).toContain(`('${table}', ${days},`);
    }
    expect(migration).toContain('FOR batch IN 1..20 LOOP');
    expect(migration).toContain(
      'WHERE created_at < cutoff ORDER BY created_at LIMIT 5000'
    );
    expect(migration).toContain('FOR UPDATE SKIP LOCKED');
    expect(migration).toContain('SET search_path = pg_catalog, pg_temp');
    expect(migration).toContain('FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('TO service_role');
    expect(migration).toContain('AND c.active');
    expect(migration).not.toContain('WHEN insufficient_privilege');
  });

  it('preserves positional RPC rows and exposes summaries without actor/context data', () => {
    expect(migration).toContain("jsonb_build_object('summaries'");
    expect(migration).toContain(
      'RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER'
    );
    expect(migration).toContain('TO analytics_reader, service_role');
    for (const key of [
      'mealName',
      'modelProfile',
      'models',
      'caloriesKcal',
      'proteinG',
      'carbohydrateG',
      'fatG',
      'itemCount',
      'errorCode',
      'traceLogged',
    ])
      expect(migration).toContain(`'${key}'`);
    expect(migration).not.toContain("'userId'");
    expect(migration).not.toContain("'userContext'");
    expect(migration).toContain(
      'DROP INDEX IF EXISTS public.pipeline_requests_user_id_created_at_idx'
    );
    expect(
      getTableConfig(pipelineRequests).indexes.some(
        (index) => index.config.name === 'pipeline_requests_created_id_idx'
      )
    ).toBe(true);
  });
});
