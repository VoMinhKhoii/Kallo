import { createHash } from 'node:crypto';
import { normalizeText, STATE_SUFFIX_TOKENS, tokens } from './nin-text';
import type {
  ConstructedRow,
  FoodLabel,
  NormalizedRow,
  SnapshotRow,
} from './nin-types';

const COOKED_TOKENS = new Set([
  'luộc',
  'hấp',
  'nướng',
  'rán',
  'chiên',
  'rang',
  'chần',
  'quay',
  'nấu',
  'hầm',
  'xào',
  'chín',
  'kho',
  'tần',
]);
const BOWL_CODES = new Set([
  '15023',
  '15024',
  '15033',
  '15034',
  '15035',
  '15036',
  '15037',
  '15038',
  '15039',
  '15042',
  '15043',
  '15044',
  '15045',
  '15046',
  '15047',
  '15048',
  '15049',
  '15050',
  '15051',
  '15052',
  '15053',
  '15054',
  '15055',
  '15056',
  '15057',
  '15058',
  '15059',
  '15060',
  '15061',
  '15064',
  '15065',
  '15066',
  '15067',
  '15075',
  '15076',
]);
const BROTH_CODES = new Set([
  '7096',
  '7120',
  '7132',
  '7140',
  '7141',
  '13073',
  '13074',
  '13075',
]);
const COMPOSITE_CODES = new Set([
  '1009',
  '1038',
  '1024002',
  '12089',
  '12090',
  '12091',
  '7072',
  '7091',
  '7118002',
  '11021',
  '3033',
]);
const COMPOSITE_PATTERN =
  /^(bánh|chả|giò|nem|xôi|kẹo|mứt|kem|sữa chua|tào phớ|thịt xiên)/i;

function nutrient(row: SnapshotRow, englishName: string): number | null {
  return (
    row.nutrition.find((item) => item.name_en === englishName)?.value ?? null
  );
}

function alcoholFromName(name: string): number | null {
  const match = name.match(/cồn\s*:?[ ]*(\d+(?:[.,]\d+)?)\s*g/i);
  return match ? Number(match[1].replace(',', '.')) : null;
}

export function normalizeRows(rows: SnapshotRow[]): NormalizedRow[] {
  return rows.map((row) => {
    const nutrition = row.nutrition.filter(
      (item) => item.name.trim() || item.value !== null
    );
    const cleaned = { ...row, nutrition };
    return {
      ...cleaned,
      name_en: row.name_en?.trim() ?? '',
      categoryEn: row.categoryEn?.trim() ?? '',
      nutrients: Object.fromEntries(
        nutrition.map((item) => [item.name_en || item.name, item.value])
      ),
      protein: nutrient(cleaned, 'Protein'),
      fat: nutrient(cleaned, 'Total lipid (Fat)'),
      carbohydrate: nutrient(cleaned, 'Carbohydrate by difference'),
      water: nutrient(cleaned, 'Water'),
      fiber: nutrient(cleaned, 'Fiber, total dietary'),
      alcohol:
        nutrient(cleaned, 'Alcohol, ethyl') ?? alcoholFromName(row.name_vi),
    };
  });
}

export function atwaterResult(row: NormalizedRow): {
  computed: number;
  relativeError: number;
  reasons: string[];
} {
  const computed =
    4 * (row.protein ?? 0) +
    9 * (row.fat ?? 0) +
    4 * (row.carbohydrate ?? 0) +
    7 * (row.alcohol ?? 0);
  const relativeError =
    Math.abs(computed - row.energy) / Math.max(row.energy, 10);
  const reasons: string[] = [];
  if (relativeError > 0.2) {
    reasons.push(`atwater_relative_error=${relativeError.toFixed(3)}`);
  }
  if (row.energy === 1) reasons.push('placeholder_energy_1');
  if (row.code === '4139') reasons.push('fabricated_round_macro_vector');
  return { computed, relativeError, reasons };
}

export function nutrientVector(row: NormalizedRow): string {
  return JSON.stringify(
    [...row.nutrition]
      .map((item) => [item.name_en || item.name, item.unit, item.value])
      .sort(([a], [b]) => String(a).localeCompare(String(b)))
  );
}

function representativeScore(row: NormalizedRow): [number, number, string] {
  const modifiers = normalizeText(row.name_vi)
    .split(' ')
    .filter((token) => STATE_SUFFIX_TOKENS.has(token)).length;
  return [modifiers, normalizeText(row.name_vi).split(' ').length, row.code];
}

export function dedupeClones(rows: NormalizedRow[]): {
  kept: NormalizedRow[];
  groups: { group: number; kept: NormalizedRow; dropped: NormalizedRow[] }[];
} {
  const byVector = Map.groupBy(rows, nutrientVector);
  const groups = [...byVector.values()]
    .filter((group) => group.length > 1)
    .map((group, index) => {
      const sorted = [...group].sort((a, b) => {
        const aa = representativeScore(a);
        const bb = representativeScore(b);
        return aa[0] - bb[0] || aa[1] - bb[1] || aa[2].localeCompare(bb[2]);
      });
      return { group: index + 1, kept: sorted[0], dropped: sorted.slice(1) };
    });
  const droppedCodes = new Set(
    groups.flatMap((group) => group.dropped.map((r) => r.code))
  );
  return { kept: rows.filter((row) => !droppedCodes.has(row.code)), groups };
}

export function classify(row: NormalizedRow): {
  label: FoodLabel;
  reason: string;
} {
  if (BOWL_CODES.has(row.code)) {
    return {
      label: 'bowl',
      reason: 'heterogeneous bowl/soup/sandwich/salad exclusion',
    };
  }
  if (BROTH_CODES.has(row.code)) {
    return {
      label: 'condiment-broth',
      reason: 'broth/marinade/near-zero preparation',
    };
  }
  if (COMPOSITE_CODES.has(row.code) || COMPOSITE_PATTERN.test(row.name_vi)) {
    return {
      label: 'composite',
      reason: 'atomic-stable or prepared composite',
    };
  }
  return { label: 'ingredient', reason: 'single ingredient/reference food' };
}

export function inferState(name: string): 'raw' | 'cooked' {
  return tokens(name).some((token) => COOKED_TOKENS.has(token))
    ? 'cooked'
    : 'raw';
}

const EXACT_ALIASES: Record<string, string[]> = {
  '15006': ['Bánh chưng'],
  '15009': ['Bánh cuốn'],
  '15017': ['Bánh giò'],
  '15041': ['Chả quế'],
  '1009': ['Bánh bao nhân thịt'],
};

export function constructRows(rows: NormalizedRow[]): ConstructedRow[] {
  const collisions = new Map<string, number>();
  return rows.map((row) => {
    const count = (collisions.get(row.code) ?? 0) + 1;
    collisions.set(row.code, count);
    return {
      id: `nin_web_${row.code}${count > 1 ? `_${count}` : ''}`,
      code: row.code,
      namePrimary: row.name_vi,
      nameAlt: EXACT_ALIASES[row.code] ?? [],
      nameEn: row.name_en,
      typeVn: row.category,
      typeEn: row.categoryEn,
      state: inferState(row.name_vi),
      caloriesKcal: row.energy,
      proteinG: row.protein,
      carbohydrateG: row.carbohydrate,
      fatG: row.fat,
      fiberG: row.fiber,
      waterG: row.water,
    };
  });
}

export function snapshotSha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
