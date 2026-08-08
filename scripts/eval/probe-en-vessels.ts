/**
 * Does English piece-vessel resolution need an explicit `piece(s) of` unit,
 * rather than a compound food name like "salmon fillet"?
 *
 * Hypothesis: `fillet` and `steak` ARE in PIECE_UNIT_TOKENS, but Call 1 reads
 * "1 salmon fillet" as a food NAME and never emits a separate unit token, so
 * `resolvePieceVessel` finds no `source.unitToken` and bails.
 */
import type { UserContext } from '@/lib/ai/types';

const NEUTRAL: UserContext = {
  goal: 'maintaining',
  aggression: 0,
  countryOfOrigin: 'VN',
  countryOfResidence: 'VN',
  cookingHabits: {
    oilUsage: 'normal',
    defaultRicePortion: 'medium',
    defaultProteinPortion: 'medium',
    sugarBraised: 'medium',
    brothConsumption: 'some',
  },
};

const CASES = [
  '1 salmon fillet, pan-seared, with a green salad',
  '2 pieces of pan-seared salmon with a green salad',
  '1 grilled steak with fries',
  '2 pieces of grilled steak with fries',
];

const [{ analyzeMealV2 }, gemini, { db }, { toParsedMeal }] = await Promise.all([
  import('@/lib/ai/pipeline/grounded-orchestrator'),
  import('@/lib/ai/gemini'),
  import('@/lib/db'),
  import('@/lib/ai/mappers'),
]);
const client = gemini.createGeminiClient(gemini.resolveGeminiProvider());

for (const text of CASES) {
  let handle: ReturnType<typeof setTimeout> | undefined;
  try {
    const res = await Promise.race([
      analyzeMealV2(text, NEUTRAL, db, client),
      new Promise<never>((_, reject) => {
        handle = setTimeout(() => reject(new Error('timeout')), 180_000);
      }),
    ]).finally(() => clearTimeout(handle));
    if (!res.success) {
      console.log(`✗ "${text}" — failed`);
      continue;
    }
    const p = toParsedMeal(res.data);
    const vessels = p.items
      .map((i) => {
        const v = i.vessel as
          | { family: string; tier: number; kind?: string; count?: number }
          | undefined;
        return v
          ? `${v.family} t${v.tier}${v.kind ? `/${v.kind}` : ''}${v.count ? ` x${v.count}` : ''}`
          : '—';
      })
      .join(' | ');
    console.log(`${vessels === '—' || vessels.startsWith('— |') ? '✗' : '✓'} "${text}"\n    ${vessels}`);
  } catch (error) {
    console.log(`✗ "${text}" — ${(error as Error).message}`);
  }
}
process.exit(0);
