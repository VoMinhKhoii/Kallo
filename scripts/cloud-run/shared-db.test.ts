import { describe, expect, it } from 'vitest';

import {
  extractProjectRefFromDatabaseUrl,
  parseSharedDbStateOutput,
  validateProjectRefAlignment,
} from './shared-db.mjs';

describe('shared-db helpers', () => {
  it('extracts the project ref from a direct Supabase connection URL', () => {
    expect(
      extractProjectRefFromDatabaseUrl(
        'postgresql://postgres:secret@db.abcd1234.supabase.co:5432/postgres'
      )
    ).toBe('abcd1234');
  });

  it('extracts the project ref from a Supabase pooler URL', () => {
    expect(
      extractProjectRefFromDatabaseUrl(
        'postgresql://postgres.abcd1234:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres'
      )
    ).toBe('abcd1234');
  });

  it('extracts the project ref when the password contains reserved URL characters', () => {
    expect(
      extractProjectRefFromDatabaseUrl(
        'postgresql://postgres:%23weird?p@ss@db.abcd1234.supabase.co:5432/postgres'
      )
    ).toBe('abcd1234');
  });

  it('returns null when the project ref cannot be derived', () => {
    expect(
      extractProjectRefFromDatabaseUrl(
        'postgresql://postgres:secret@example.com:5432/postgres'
      )
    ).toBeNull();
  });

  it('throws when the database URL and project ref do not align', () => {
    expect(() =>
      validateProjectRefAlignment(
        'postgresql://postgres:secret@db.abcd1234.supabase.co:5432/postgres',
        'wxyz7890'
      )
    ).toThrow(
      'Shared staging DATABASE_URL points at Supabase project "abcd1234", but SUPABASE_PROJECT_ID is "wxyz7890".'
    );
  });

  it('parses the psql state row into a typed object', () => {
    expect(parseSharedDbStateOutput('1|1|1|1|526|0\n')).toEqual({
      hasUserProfiles: true,
      hasFoodTable: true,
      hasFoodSourceId: true,
      hasNewUserTrigger: true,
      seededFoodRows: 526,
      orphanedAuthUsers: 0,
    });
  });

  it('rejects non-numeric row counts', () => {
    expect(() => parseSharedDbStateOutput('1|1|1|1|NaN|oops\n')).toThrow(
      'Malformed shared DB state row (non-numeric counts): 1|1|1|1|NaN|oops'
    );
  });
});
