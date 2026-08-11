import { sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
  getNutritionPeriod,
  localDateSqlExpression,
} from '@/lib/nutrition/pattern/date-range';

describe('getNutritionPeriod', () => {
  it('snaps 7d to the current Monday→Sunday week in local dates', () => {
    // 2026-04-25 is a Saturday → Mon 20th through Sun 26th, so the window
    // runs one day past "today" and that column stays empty until lived.
    expect(
      getNutritionPeriod({
        range: '7d',
        now: new Date('2026-04-25T12:00:00.000Z'),
        timezoneOffset: -420,
      })
    ).toEqual({
      startDate: '2026-04-20',
      endDate: '2026-04-26',
      bucketTimezone: 'local',
    });
  });

  it('keeps a Monday on its own week rather than reaching back a week', () => {
    expect(
      getNutritionPeriod({
        range: '7d',
        now: new Date('2026-05-04T12:00:00.000Z'),
        timezoneOffset: -420,
      })
    ).toMatchObject({ startDate: '2026-05-04', endDate: '2026-05-10' });
  });

  it('keeps a Sunday at the END of its week, not the start', () => {
    expect(
      getNutritionPeriod({
        range: '7d',
        now: new Date('2026-05-03T12:00:00.000Z'),
        timezoneOffset: -420,
      })
    ).toMatchObject({ startDate: '2026-04-27', endDate: '2026-05-03' });
  });

  it('keeps the trailing window for the longer ranges', () => {
    expect(
      getNutritionPeriod({
        range: '90d',
        now: new Date('2026-04-25T12:00:00.000Z'),
        timezoneOffset: -420,
      })
    ).toMatchObject({ startDate: '2026-01-26', endDate: '2026-04-25' });
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
      // 01:30Z at UTC+? — the +300 offset pulls the local date back to Friday
      // the 24th, whose week is Mon 20th → Sun 26th.
      startDate: '2026-04-20',
      endDate: '2026-04-26',
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
