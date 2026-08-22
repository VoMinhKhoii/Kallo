const COMPACT_PIPELINE_ID_RE = /^[mi][1-9]\d*$/;
const LEGACY_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CompactIdSequence {
  nextMealItemId: (seen?: ReadonlySet<string>) => string;
  nextIngredientId: (seen?: ReadonlySet<string>) => string;
}

export function isCompactPipelineId(value: unknown): value is string {
  return typeof value === 'string' && COMPACT_PIPELINE_ID_RE.test(value);
}

export function isLegacyPipelineUuid(value: unknown): value is string {
  return typeof value === 'string' && LEGACY_UUID_RE.test(value);
}

function nextId(prefix: 'm' | 'i', counter: { value: number }) {
  return (seen: ReadonlySet<string> = new Set()): string => {
    let id = `${prefix}${counter.value}`;
    counter.value += 1;

    while (seen.has(id)) {
      id = `${prefix}${counter.value}`;
      counter.value += 1;
    }

    return id;
  };
}

export function createCompactIdSequence(): CompactIdSequence {
  return {
    nextMealItemId: nextId('m', { value: 1 }),
    nextIngredientId: nextId('i', { value: 1 }),
  };
}
