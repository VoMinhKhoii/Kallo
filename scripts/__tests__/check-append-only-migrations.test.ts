import { describe, expect, it } from 'vitest';
import {
  findDisallowedOperations,
  splitStatements,
  stripSqlComments,
} from '../check-append-only-migrations.mjs';

describe('stripSqlComments', () => {
  it('removes line and block comments', () => {
    expect(
      stripSqlComments(`
-- comment
ALTER TABLE meals ADD COLUMN note text;
/* block comment */
`)
    ).toContain('ALTER TABLE meals ADD COLUMN note text;');
  });
});

describe('splitStatements', () => {
  it('normalizes SQL statements for matching', () => {
    expect(
      splitStatements('ALTER TABLE meals ADD COLUMN note text;\n\nSELECT 1;')
    ).toEqual(['ALTER TABLE MEALS ADD COLUMN NOTE TEXT', 'SELECT 1']);
  });
});

describe('findDisallowedOperations', () => {
  it('allows additive migrations', () => {
    expect(
      findDisallowedOperations(
        'ALTER TABLE meals ADD COLUMN instructions text;'
      )
    ).toEqual([]);
  });

  it('flags destructive column drops', () => {
    expect(
      findDisallowedOperations('ALTER TABLE meals DROP COLUMN recipe_notes;')[0]
    ).toMatchObject({
      label: 'DROP COLUMN',
    });
  });

  it('flags destructive shorthand ALTER TABLE forms', () => {
    const matches: Array<{ label: string }> = findDisallowedOperations(`
ALTER TABLE meals DROP recipe_notes;
ALTER TABLE meals RENAME recipe_notes TO instructions;
ALTER TABLE meals ALTER calories TYPE numeric;
`);

    expect(matches.map((match) => match.label)).toEqual([
      'DROP COLUMN',
      'RENAME COLUMN',
      'ALTER COLUMN TYPE',
    ]);
  });

  it('flags drop table statements', () => {
    expect(findDisallowedOperations('DROP TABLE meals;')[0]).toMatchObject({
      label: 'DROP TABLE',
    });
  });
});
