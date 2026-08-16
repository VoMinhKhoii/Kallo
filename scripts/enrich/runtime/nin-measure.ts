import { readFileSync } from 'node:fs';
import { GoogleGenAI } from '@google/genai';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { retrieveHybridTopK } from '@/lib/ai/matching/retrieve/top-k-retrieval';
import { type AppDb, encodeDbUrl } from '@/lib/db';
import { foldText } from '../nin-text';

const STABLE_QUERIES = ['ức gà', 'thịt heo', 'nước mắm', 'cơm', 'tôm', 'xôi'];

function gapQueries(reportPath: string): string[] {
  const report = readFileSync(reportPath, 'utf8');
  const section = report.split('## Coverage gaps')[1]?.split('\n## ')[0] ?? '';
  return section
    .split('\n')
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim());
}

function sameFamily(query: string, name: string): boolean {
  const queryTokens = foldText(query)
    .split(' ')
    .filter((token) => token.length > 1);
  const nameTokens = new Set(foldText(name).split(' '));
  return (
    queryTokens.length > 0 &&
    queryTokens.every((token) => nameTokens.has(token))
  );
}

export async function measureRetrieval(reportPath: string): Promise<unknown> {
  if (!process.env.DATABASE_URL || !process.env.GEMINI_API_KEY) {
    throw new Error(
      'DATABASE_URL and GEMINI_API_KEY are required for measurement'
    );
  }
  const gaps = gapQueries(reportPath);
  if (gaps.length !== 104)
    throw new Error(`Expected 104 gap queries, found ${gaps.length}`);
  const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const client = postgres(encodeDbUrl(process.env.DATABASE_URL), { max: 4 });
  const db = drizzle(client) as AppDb;
  try {
    const queries = [...gaps, ...STABLE_QUERIES];
    const results = [];
    for (let index = 0; index < queries.length; index += 50) {
      const batch = queries.slice(index, index + 50);
      const response = await genai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: batch.map((text) => ({ parts: [{ text }] })),
        config: { outputDimensionality: 768 },
      });
      for (let i = 0; i < batch.length; i++) {
        const query = batch[i];
        const embedding = response.embeddings?.[i]?.values;
        if (!embedding) throw new Error(`Missing embedding for ${query}`);
        const retrieval = await retrieveHybridTopK({
          matchingName: query,
          embedding,
          db,
          k: 3,
          sourceLimit: 3,
          expectedState: 'unknown',
        });
        const candidates = retrieval.candidates.map((candidate) => ({
          id: candidate.foodCompositionId,
          name: candidate.matchedName,
          state: candidate.state,
        }));
        results.push({
          query,
          correctFamilyTop3: candidates.some((candidate) =>
            sameFamily(query, candidate.name)
          ),
          candidates,
        });
      }
    }
    const gapResults = results.slice(0, gaps.length);
    return {
      measuredAt: new Date().toISOString(),
      gapCount: gaps.length,
      correctFamilyTop3: gapResults.filter((row) => row.correctFamilyTop3)
        .length,
      xoiRaspberryRegression:
        results
          .find((row) => row.query === 'xôi')
          ?.candidates.some((candidate) =>
            foldText(candidate.name).includes('mam xoi')
          ) ?? false,
      stableQueries: results.slice(gaps.length),
      gaps: gapResults,
      familyVerdict:
        'deterministic token-boundary heuristic; inspect raw candidates',
    };
  } finally {
    await client.end();
  }
}
