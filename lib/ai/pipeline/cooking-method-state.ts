export const COOKING_METHOD_STATE: Readonly<Record<string, 'raw' | 'cooked'>> =
  Object.freeze({
    luộc: 'cooked',
    hấp: 'cooked',
    chưng: 'cooked',
    nướng: 'cooked',
    quay: 'cooked',
    rán: 'cooked',
    chiên: 'cooked',
    xào: 'cooked',
    kho: 'cooked',
    om: 'cooked',
    nấu: 'cooked',
    áp_chảo: 'cooked',
    'áp chảo': 'cooked',
    sống: 'raw',
    'tươi sống': 'raw',
    tái: 'raw',
    gỏi: 'raw',
    raw: 'raw',
  });

export interface DeriveStateInput {
  explicit: 'raw' | 'cooked' | undefined;
  dishMethod: string | null | undefined;
}

export interface DeriveStateOutput {
  state: 'raw' | 'cooked';
  source: 'explicit' | 'method_lookup' | 'unknown';
}

/**
 * Derive expectedState without unaccenting. Vietnamese diacritics are
 * semantically load-bearing, so lookup normalization is trim + lowercase only.
 */
export function deriveExpectedState(
  input: DeriveStateInput
): DeriveStateOutput {
  if (input.explicit) {
    return { state: input.explicit, source: 'explicit' };
  }

  const key = (input.dishMethod ?? '').trim().toLocaleLowerCase('vi-VN');
  const hit = COOKING_METHOD_STATE[key];
  if (hit) {
    return { state: hit, source: 'method_lookup' };
  }

  return { state: 'cooked', source: 'unknown' };
}
