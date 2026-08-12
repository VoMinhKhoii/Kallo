import {
  COOKING_TOKENS,
  foldText,
  STATE_SUFFIX_TOKENS,
  tokens,
} from './nin-text';
import {
  type DbNameRow,
  dbNameRowSchema,
  type NormalizedRow,
} from './nin-types';

const REASSIGNED_CODE_START = 4108;
const REASSIGNED_CODE_END = 4126;
const LINEAGE_TOKEN_OVERLAP_THRESHOLD = 0.8;
export function parseDbNames(content: string): DbNameRow[] {
  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      const fields = line.split('\t');
      if (fields.length !== 3) {
        throw new Error(
          `Invalid DB names TSV row ${index + 1}: expected 3 fields, received ${fields.length}`
        );
      }
      const [id, namePrimary, alts] = fields;
      return dbNameRowSchema.parse({
        id,
        namePrimary,
        nameAlt: alts.split('|').filter(Boolean),
        source: id.startsWith('fao_vn_2007_')
          ? 'fao'
          : id.startsWith('usda_')
            ? 'usda'
            : 'other',
      });
    });
}

function contentSignature(value: string): string {
  const allTokens = tokens(value).sort();
  const stateTokens = allTokens.filter((token) =>
    STATE_SUFFIX_TOKENS.has(token)
  );
  return `${stateTokens.join('|')}::${allTokens.join('|')}`;
}

interface IndexedDbName {
  dbRow: DbNameRow;
  matchedName: string;
}

export interface DbNameIndex {
  bySignature: Map<string, IndexedDbName[]>;
  faoByCode: Map<string, IndexedDbName[]>;
}

function faoCode(id: string): string | null {
  return id.match(/^fao_vn_2007_(\d+)_/)?.[1] ?? null;
}

function isReassignedCode(code: string): boolean {
  const numericCode = Number(code);
  return (
    numericCode >= REASSIGNED_CODE_START && numericCode <= REASSIGNED_CODE_END
  );
}

function foldedLineageTokens(value: string): Set<string> {
  return new Set(
    tokens(value)
      .filter((token) => !STATE_SUFFIX_TOKENS.has(token))
      .map(foldText)
  );
}

function lineageTokenOverlap(left: string, right: string): number {
  const leftTokens = foldedLineageTokens(left);
  const rightTokens = foldedLineageTokens(right);
  const smallerSize = Math.min(leftTokens.size, rightTokens.size);
  if (smallerSize === 0) return 0;
  const shared = [...leftTokens].filter((token) => rightTokens.has(token));
  return shared.length / smallerSize;
}

function lineageStateCompatible(rowName: string, dbId: string): boolean {
  const rowTokens = new Set(tokens(rowName));
  const explicitlyRaw =
    rowTokens.has('tươi') || rowTokens.has('sống') || rowTokens.has('raw');
  const explicitlyCooked =
    [...rowTokens].some((token) => COOKING_TOKENS.has(token)) ||
    (rowTokens.has('chín') && !explicitlyRaw);
  if (dbId.endsWith('_raw') && explicitlyCooked) return false;
  if (dbId.endsWith('_cooked') && explicitlyRaw) return false;
  return true;
}

export function buildDbNameIndex(dbRows: DbNameRow[]): DbNameIndex {
  const bySignature: DbNameIndex['bySignature'] = new Map();
  const faoByCode: DbNameIndex['faoByCode'] = new Map();
  for (const dbRow of dbRows) {
    for (const matchedName of [dbRow.namePrimary, ...dbRow.nameAlt]) {
      const indexedName = { dbRow, matchedName };
      const signature = contentSignature(matchedName);
      const values = bySignature.get(signature) ?? [];
      values.push(indexedName);
      bySignature.set(signature, values);
      const code = faoCode(dbRow.id);
      if (code) {
        const codeValues = faoByCode.get(code) ?? [];
        codeValues.push(indexedName);
        faoByCode.set(code, codeValues);
      }
    }
  }
  return { bySignature, faoByCode };
}

export function findDuplicate(
  row: NormalizedRow,
  index: DbNameIndex
): {
  match: DbNameRow | null;
  verdict: 'duplicate-vietnamese' | 'keep-usda-only' | 'keep-no-match';
  matchedName: string;
  matchBasis: 'name' | 'code-lineage' | 'none';
} {
  const matches = index.bySignature.get(contentSignature(row.name_vi)) ?? [];
  const vietnamese = matches.find(({ dbRow }) => dbRow.source === 'fao');
  if (vietnamese) {
    return {
      match: vietnamese.dbRow,
      verdict: 'duplicate-vietnamese',
      matchedName: vietnamese.matchedName,
      matchBasis: 'name',
    };
  }
  if (!isReassignedCode(row.code)) {
    const lineage = (index.faoByCode.get(row.code) ?? []).find(
      ({ dbRow, matchedName }) =>
        lineageTokenOverlap(row.name_vi, matchedName) >=
          LINEAGE_TOKEN_OVERLAP_THRESHOLD &&
        lineageStateCompatible(row.name_vi, dbRow.id)
    );
    if (lineage) {
      return {
        match: lineage.dbRow,
        verdict: 'duplicate-vietnamese',
        matchedName: lineage.matchedName,
        matchBasis: 'code-lineage',
      };
    }
  }
  const usda = matches.find(({ dbRow }) => dbRow.source === 'usda');
  if (usda) {
    return {
      match: usda.dbRow,
      verdict: 'keep-usda-only',
      matchedName: usda.matchedName,
      matchBasis: 'name',
    };
  }
  return {
    match: null,
    verdict: 'keep-no-match',
    matchedName: '',
    matchBasis: 'none',
  };
}
