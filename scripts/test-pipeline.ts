/**
 * Quick pipeline test script — bypasses auth, calls analyzeMeal directly.
 * Usage: bun --env-file=.env.local scripts/test-pipeline.ts
 */

import { createGeminiClient } from '@/lib/ai/gemini';
import { analyzeMeal } from '@/lib/ai/pipeline';
import type { UserContext } from '@/lib/ai/types';
import { db } from '@/lib/db';

const testContext: UserContext = {
  goal: 'cutting',
  aggression: 0.5,
  regionalProfile: 'mien_nam',
  cookingHabits: {
    oilUsage: 'normal',
    defaultRicePortion: 'medium',
    sugarBraised: 'medium',
    defaultProteinPortion: 'medium',
    brothConsumption: 'some',
  },
};

const meal = process.argv[2];
if (!meal) {
  console.error(
    'Usage: bun --env-file=.env.local scripts/test-pipeline.ts "meal description"'
  );
  process.exit(1);
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Missing GEMINI_API_KEY in .env.local');
  process.exit(1);
}

console.info(`\n${'='.repeat(80)}`);
console.info(`Testing: "${meal}"`);
console.info(`${'='.repeat(80)}\n`);

const gemini = createGeminiClient(apiKey);
const result = await analyzeMeal(meal, testContext, db, gemini);

console.info(`\n${'='.repeat(80)}`);
console.info('RESULT:');
console.info(`${'='.repeat(80)}\n`);
console.info(JSON.stringify(result, null, 2));

process.exit(0);
