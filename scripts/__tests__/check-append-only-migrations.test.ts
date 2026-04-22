import { describe, expect, it } from 'vitest';

const {
  findDisallowedOperations,
  splitStatements,
  stripSqlComments,
} = require('../check-append-only-migrations.js');

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

  it('flags column renames and type changes', () => {
    const matches: Array<{ label: string }> = findDisallowedOperations(`
ALTER TABLE meals RENAME COLUMN recipe_notes TO instructions;
ALTER TABLE meals ALTER COLUMN calories TYPE numeric;
`);

    expect(matches.map((match) => match.label)).toEqual([
      'RENAME COLUMN',
      'ALTER COLUMN TYPE',
    ]);
  });
});
