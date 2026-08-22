import { describe, expect, it } from 'vitest';
import { pipelineShadowRuns } from '@/lib/infra/db/schema';

describe('pipelineShadowRuns Drizzle schema', () => {
  it('has the expected columns', () => {
    const cols = Object.keys(pipelineShadowRuns);
    for (const c of [
      'id',
      'createdAt',
      'requestId',
      'primaryRunId',
      'candidatePromptLabel',
      'candidateModel',
      'primaryOutput',
      'candidateOutput',
      'divergence',
      'outcome',
      'candidateMs',
    ]) {
      expect(cols).toContain(c);
    }
  });
});
