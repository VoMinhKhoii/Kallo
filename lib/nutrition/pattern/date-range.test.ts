import { sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { getNutritionPeriod, localDateSqlExpression } from './date-range';

describe('getNutritionPeriod', () => {
  it('includes today and returns local dates for local buckets', () => {
    expect(
      getNutritionPeriod({
        range: '7d',
        now: new Date('2026-04-25T12:00:00.000Z'),
        timezoneOffset: -420,
      })
    ).toEqual({
      startDate: '2026-04-19',
      endDate: '2026-04-25',
      bucketTimezone: 'local',
    });
  });

  it('falls back to UTC dates when timezone offset is null', () => {
    expect(
      getNutritionPeriod({
        range: '30d',
        now: new Date('2026-04-25T12:00:00.000Z'),
        timezoneOffset: null,
      })
    ).toEqual({
      startDate: '2026-03-27',
      endDate: '2026-04-25',
      bucketTimezone: 'utc',
    });
  });

  it('handles timezone offsets that shift the bucket date across UTC boundaries', () => {
    expect(
      getNutritionPeriod({
        range: '7d',
        now: new Date('2026-04-25T01:30:00.000Z'),
        timezoneOffset: 300,
      })
    ).toEqual({
      startDate: '2026-04-18',
      endDate: '2026-04-24',
      bucketTimezone: 'local',
    });
  });
});

describe('localDateSqlExpression', () => {
  const dialect = new PgDialect();

  it('returns a UTC-normalized shifted SQL date expression for local buckets', () => {
    const expr = localDateSqlExpression(sql.raw('logged_at'), -420);
    expect(dialect.sqlToQuery(expr).sql).toBe(
      "(((logged_at) AT TIME ZONE 'UTC') + ('420 minutes')::interval)::date"
    );
  });

  it('returns a UTC-normalized cast when timezone offset is null', () => {
    const expr = localDateSqlExpression(sql.raw('logged_at'), null);
    expect(dialect.sqlToQuery(expr).sql).toBe(
      "((logged_at) AT TIME ZONE 'UTC')::date"
    );
  });
});
