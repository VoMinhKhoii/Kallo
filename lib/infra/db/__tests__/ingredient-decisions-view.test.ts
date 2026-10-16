import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const previous = readFileSync(
  'supabase/migrations/20260830120045_ingredient_intelligence.sql',
  'utf8'
);
const migration = readFileSync(
  'supabase/migrations/20261016035816_ingredient_decisions_30d_with_time.sql',
  'utf8'
);
const viewBody = (sql: string) =>
  sql.slice(
    sql.indexOf('CREATE OR REPLACE VIEW analytics.v_ingredient_decisions'),
    sql.indexOf('FROM prepared;')
  );

describe('analytics.v_ingredient_decisions (no database connection)', () => {
  it('keeps 30 days and only appends occurred_at, so existing readers keep working', () => {
    const before = viewBody(previous);
    const after = viewBody(migration);
    expect(after).toContain("vp.d >= (now() - interval '30 days')::date");
    expect(
      after
        .replace("interval '30 days'", "interval '90 days'")
        .replace(
          /,\n\s+\(SELECT r\.created_at FROM public\.pipeline_requests AS r WHERE r\.id = prepared\.request_id\) AS occurred_at\n/,
          '\n'
        )
    ).toBe(before);
  });

  it('looks the request up by primary key and keeps the view private', () => {
    // uuid = uuid uses pipeline_requests_pkey; a ::text cast on both sides would scan.
    expect(migration).toContain('WHERE r.id = prepared.request_id');
    expect(migration).toContain('FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('TO analytics_reader;');
  });
});
