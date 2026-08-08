import type { EvalCaseResult, EvalFixtureRelation } from './eval-types';

/**
 * Apply cross-case assertions after every selected case has completed. A
 * relation is skipped when filtering/tiering omitted any member; otherwise it
 * is attached as one hard check to the relation's final case.
 */
export function applyEvalRelations(
  results: EvalCaseResult[],
  relations: EvalFixtureRelation[]
): EvalCaseResult[] {
  const updated = results.map((result) => ({
    ...result,
    checks: [...result.checks],
  }));
  const indexById = new Map(updated.map((result, index) => [result.id, index]));

  for (const relation of relations) {
    const indices = relation.caseIds.map((id) => indexById.get(id));
    if (indices.some((index) => index === undefined)) continue;

    const members = indices.map((index) => updated[index as number]);
    const actual = members.map(
      (result) => result.mealMacros?.fatG?.mid ?? null
    );
    const pass = actual.every((fat, index) => {
      if (fat == null) return false;
      if (index === 0) return true;
      const previous = actual[index - 1];
      return previous != null && previous < fat;
    });
    const anchorIndex = indices[indices.length - 1] as number;
    const anchor = updated[anchorIndex];
    anchor.checks.push({
      name: `relation:${relation.id}:${relation.kind}`,
      pass,
      expected: relation.caseIds,
      actual,
    });
    anchor.pass = anchor.pass && pass;
  }

  return updated;
}
