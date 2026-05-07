# AI Pipeline Latency Regression Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Identify and fix the branch change that regressed warm-cache meal analysis from production/main's ~8-10s with `gemini-3.1-flash-lite` to 30-50s.

**Architecture:** Preserve the current dirty branch state, benchmark clean controls in separate worktrees, and measure the real pipeline with stage-level timing instead of guessing. Use the resulting data to disable, revert, or surgically fix only the measured latency offender while keeping reliability fixes that do not regress speed.

**Tech Stack:** Next.js App Router, Bun, TypeScript, Vitest, Biome 2.4.2, Gemini `@google/genai`, Drizzle/Supabase telemetry, Server-Sent Events.

---

## File Structure

### Create

- `scripts/benchmark-ai-pipeline-latency.ts` — local-only benchmark runner that calls the real pipeline modules directly and writes machine-readable timing summaries. It must not contain credentials, user IDs, or secrets.
- `scripts/__tests__/benchmark-ai-pipeline-latency.test.ts` — unit tests for benchmark result summarization, threshold evaluation, and matrix construction. It must not call Gemini.
- `scripts/benchmark-ai-pipeline-latency/config.ts` — benchmark meal set, variant matrix, and latency gate helpers if the single script grows too large.
- `scripts/benchmark-ai-pipeline-latency/runner.ts` — real pipeline execution helpers if the single script grows too large.
- `docs/superpowers/plans/2026-05-08-ai-pipeline-latency-regression.md` — this plan.

### Modify

- `lib/ai/pipeline/orchestrator.ts` — only if measurement shows missing stage metadata or a specific latency bug here. Do not add speculative optimizations.
- `lib/ai/gemini.ts` — only if measurement proves retry/stream/provider behavior is the latency source.
- `lib/ai/prompts/decomposition.ts` — only if compressed decomposition is the measured offender.
- `lib/ai/prompts/nutrition.ts` — only if compressed nutrition is the measured offender.
- `lib/ai/prompts/schema.ts` — only if slim schema is the measured offender.
- `lib/fetch-with-timeout.ts` — only if timeout semantics are still implicated after measurement.
- `lib/ai/matching/**` — only if matching/cache misses account for the regression.

### Do Not Modify Unless Explicitly Needed

- `components/ui/**` — shadcn-managed.
- `package.json` — no dependency changes are expected.
- `supabase/migrations/**` — this is a latency investigation, not a schema change.
- `.env.local` — may be read by commands, but never committed or printed.

---

## Chunk 1: Preserve Current Work And Create Benchmark Workspaces

### Task 1: Capture the dirty branch state without losing work

**Files:**
- Read: current git worktree
- Create outside repo: `/Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-dirty-worktree.patch`
- Create outside repo: `/Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-staged-worktree.patch`
- Create outside repo: `/Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-untracked-files.txt`
- Create outside repo: `/Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-untracked/`

- [ ] **Step 1: Inspect the current dirty state**

Run:

```bash
git --no-pager status --short
git --no-pager diff --stat
```

Expected: shows the existing reliability changes in pipeline, prompt, matching, debug, and timeout files. Do not revert them.

- [ ] **Step 2: Save tracked-file patch snapshots outside the repo**

Run:

```bash
git --no-pager diff HEAD --binary > /Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-dirty-worktree.patch
git --no-pager diff --cached --binary > /Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-staged-worktree.patch
```

Expected: commands succeed and write non-repo patch artifacts. `diff HEAD` captures all tracked changes relative to `HEAD`; the cached patch separately records any staged/index state.

- [ ] **Step 3: Save untracked files outside the repo**

Run:

```bash
git ls-files --others --exclude-standard > /Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-untracked-files.txt
mkdir -p /Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-untracked
while IFS= read -r path; do
  [ -z "$path" ] && continue
  mkdir -p "/Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-untracked/$(dirname "$path")"
  cp -p "$path" "/Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-untracked/$path"
done < /Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-untracked-files.txt
```

Expected: untracked files are copied outside the repo. If there are no untracked files, the file list is empty and the step still succeeds.

- [ ] **Step 4: Verify the preservation artifacts exist**

Run:

```bash
test -s /Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-dirty-worktree.patch
test -f /Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-staged-worktree.patch
test -f /Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-untracked-files.txt
```

Expected: exit code 0 for the dirty patch when tracked files are dirty, and the staged patch plus untracked file list exist.

### Task 2: Create clean comparison worktrees

**Files:**
- Create sibling worktree: `/Users/khoivo/Documents/nham-latency-main`
- Create sibling worktree: `/Users/khoivo/Documents/nham-latency-branch-clean`

- [ ] **Step 1: Fetch refs**

Run:

```bash
git fetch origin main
```

Expected: fetch succeeds.

- [ ] **Step 2: Create a clean main worktree**

Run:

```bash
git worktree add /Users/khoivo/Documents/nham-latency-main origin/main
```

Expected: worktree is created at the requested path. If the path already exists, inspect it before reusing it.

- [ ] **Step 3: Create a clean branch worktree**

Run:

```bash
git worktree add --detach /Users/khoivo/Documents/nham-latency-branch-clean feat/ai-pipeline-prompt-context
```

Expected: detached worktree is created at the requested path without the current dirty reliability edits. Detached mode is required because `feat/ai-pipeline-prompt-context` is already checked out in the original worktree.

- [ ] **Step 4: Confirm worktrees**

Run:

```bash
git worktree list
```

Expected: output includes the original repo, `nham-latency-main`, and `nham-latency-branch-clean`.

### Task 3: Prepare env parity without leaking secrets

**Files:**
- Read: `.env.local`
- Do not create committed env files

- [ ] **Step 1: Confirm required local env names only**

Run:

```bash
grep -E '^(GEMINI_API_KEY|GOOGLE_GENERATIVE_AI_API_KEY|DATABASE_URL|ANALYSIS_GUARD_HASH_SECRET|PIPELINE_)=' .env.local | sed -E 's/=.*$/=<set>/'
```

Expected: prints only variable names with `<set>`, no secret values.

- [ ] **Step 2: Use the same env file for benchmark commands**

When running Bun scripts in any worktree, use:

```bash
bun --env-file=/Users/khoivo/Documents/nham-ai-pipeline-impl/.env.local <command>
```

Expected: all worktrees share the same local env values without copying `.env.local`.

---

## Chunk 2: Build A Real-Pipeline Benchmark Harness

### Task 4: Write failing tests for benchmark matrix and threshold logic

**Files:**
- Create: `scripts/__tests__/benchmark-ai-pipeline-latency.test.ts`
- Create later: `scripts/benchmark-ai-pipeline-latency.ts`

- [ ] **Step 1: Add tests for matrix construction**

Create `scripts/__tests__/benchmark-ai-pipeline-latency.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  evaluateLatencyGate,
  LATENCY_BENCHMARK_MEALS,
  LATENCY_BENCHMARK_VARIANTS,
  summarizeBenchmarkResults,
} from '../benchmark-ai-pipeline-latency';

describe('latency benchmark configuration', () => {
  it('uses the production latency meal set', () => {
    expect(LATENCY_BENCHMARK_MEALS.map((meal) => meal.input)).toEqual([
      'Phở bò tái',
      'Bún chả Hà Nội',
      '2 mực kho + cơm',
      'mực kho với nước mắm đường dầu ăn và cơm trắng',
      'chicken breast with white rice',
    ]);
  });

  it('keeps gemini-3.1-flash-lite as the baseline model', () => {
    expect(
      LATENCY_BENCHMARK_VARIANTS.every(
        (variant) => variant.modelProfile === 'stable'
      )
    ).toBe(true);
  });
});

describe('latency benchmark summaries', () => {
  it('fails the gate when branch warm-cache latency exceeds 10s', () => {
    expect(
      evaluateLatencyGate({
        targetMs: 10_000,
        mainWarmP50Ms: 8_500,
        branchWarmP50Ms: 31_000,
      })
    ).toEqual({
      pass: false,
      reason: 'branch_warm_latency_exceeds_target',
    });
  });

  it('fails the gate when branch is materially slower than main control', () => {
    expect(
      evaluateLatencyGate({
        targetMs: 10_000,
        mainWarmP50Ms: 14_000,
        branchWarmP50Ms: 28_500,
      })
    ).toEqual({
      pass: false,
      reason: 'branch_materially_slower_than_main',
    });
  });

  it('summarizes retry counts and stage timings', () => {
    const summary = summarizeBenchmarkResults([
      {
        meal: 'Phở bò tái',
        variant: 'all-off',
        success: true,
        totalMs: 9_000,
        stages: { decompositionMs: 3_000, matchingMs: 500, nutritionMs: 5_500 },
        providerAttempts: { decomposition: 1, nutrition: 1 },
        retryStep2Count: 0,
        unmatchedCount: 0,
      },
    ]);

    expect(summary).toMatchObject({
      count: 1,
      successCount: 1,
      maxTotalMs: 9_000,
      retryStep2Count: 0,
      maxNutritionAttempts: 1,
    });
  });

  it('summarizes empty results safely', () => {
    expect(summarizeBenchmarkResults([])).toEqual({
      count: 0,
      successCount: 0,
      maxTotalMs: 0,
      retryStep2Count: 0,
      maxNutritionAttempts: 0,
    });
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
bun run test scripts/__tests__/benchmark-ai-pipeline-latency.test.ts
```

Expected: FAIL because `scripts/benchmark-ai-pipeline-latency.ts` does not exist.

### Task 5: Implement pure benchmark helpers

**Files:**
- Create: `scripts/benchmark-ai-pipeline-latency.ts`
- Test: `scripts/__tests__/benchmark-ai-pipeline-latency.test.ts`

- [ ] **Step 1: Add exported constants and pure helpers**

Create `scripts/benchmark-ai-pipeline-latency.ts` with:

```ts
export interface LatencyBenchmarkMeal {
  input: string;
}

export interface LatencyBenchmarkVariant {
  label: string;
  modelProfile: 'stable';
  env: Record<string, string | undefined>;
}

export interface LatencyBenchmarkResult {
  meal: string;
  variant: string;
  success: boolean;
  totalMs: number;
  stages: {
    decompositionMs: number | null;
    matchingMs: number | null;
    nutritionMs: number | null;
  };
  providerAttempts: {
    decomposition: number;
    nutrition: number;
  };
  retryStep2Count: number;
  unmatchedCount: number;
}

export interface LatencyGateInput {
  targetMs: number;
  mainWarmP50Ms: number;
  branchWarmP50Ms: number;
}

export const LATENCY_BENCHMARK_MEALS: LatencyBenchmarkMeal[] = [
  { input: 'Phở bò tái' },
  { input: 'Bún chả Hà Nội' },
  { input: '2 mực kho + cơm' },
  { input: 'mực kho với nước mắm đường dầu ăn và cơm trắng' },
  { input: 'chicken breast with white rice' },
];

export const LATENCY_BENCHMARK_VARIANTS: LatencyBenchmarkVariant[] = [
  {
    label: 'all-off',
    modelProfile: 'stable',
    env: {
      PIPELINE_MODEL_PROFILE: 'stable',
      PIPELINE_PROVIDER_SCHEMA_MODE: undefined,
      PIPELINE_DECOMPOSITION_PROMPT_LABEL: undefined,
      PIPELINE_NUTRITION_PROMPT_LABEL: undefined,
    },
  },
  {
    label: 'slim-schema-only',
    modelProfile: 'stable',
    env: {
      PIPELINE_MODEL_PROFILE: 'stable',
      PIPELINE_PROVIDER_SCHEMA_MODE: 'slim',
      PIPELINE_DECOMPOSITION_PROMPT_LABEL: undefined,
      PIPELINE_NUTRITION_PROMPT_LABEL: undefined,
    },
  },
  {
    label: 'compressed-decomposition-only',
    modelProfile: 'stable',
    env: {
      PIPELINE_MODEL_PROFILE: 'stable',
      PIPELINE_PROVIDER_SCHEMA_MODE: undefined,
      PIPELINE_DECOMPOSITION_PROMPT_LABEL: 'compressed',
      PIPELINE_NUTRITION_PROMPT_LABEL: undefined,
    },
  },
  {
    label: 'compressed-nutrition-only',
    modelProfile: 'stable',
    env: {
      PIPELINE_MODEL_PROFILE: 'stable',
      PIPELINE_PROVIDER_SCHEMA_MODE: undefined,
      PIPELINE_DECOMPOSITION_PROMPT_LABEL: undefined,
      PIPELINE_NUTRITION_PROMPT_LABEL: 'compressed',
    },
  },
  {
    label: 'all-compressed',
    modelProfile: 'stable',
    env: {
      PIPELINE_MODEL_PROFILE: 'stable',
      PIPELINE_PROVIDER_SCHEMA_MODE: 'slim',
      PIPELINE_DECOMPOSITION_PROMPT_LABEL: 'compressed',
      PIPELINE_NUTRITION_PROMPT_LABEL: 'compressed',
    },
  },
];

export function evaluateLatencyGate(input: LatencyGateInput) {
  if (input.branchWarmP50Ms > input.targetMs) {
    return {
      pass: false,
      reason: 'branch_warm_latency_exceeds_target' as const,
    };
  }

  if (input.branchWarmP50Ms > input.mainWarmP50Ms * 1.25) {
    return {
      pass: false,
      reason: 'branch_materially_slower_than_main' as const,
    };
  }

  return { pass: true, reason: 'passed' as const };
}

export function summarizeBenchmarkResults(results: LatencyBenchmarkResult[]) {
  if (results.length === 0) {
    return {
      count: 0,
      successCount: 0,
      maxTotalMs: 0,
      retryStep2Count: 0,
      maxNutritionAttempts: 0,
    };
  }

  return {
    count: results.length,
    successCount: results.filter((result) => result.success).length,
    maxTotalMs: Math.max(...results.map((result) => result.totalMs)),
    retryStep2Count: results.reduce(
      (sum, result) => sum + result.retryStep2Count,
      0
    ),
    maxNutritionAttempts: Math.max(
      ...results.map((result) => result.providerAttempts.nutrition)
    ),
  };
}
```

- [ ] **Step 2: Run helper tests**

Run:

```bash
bun run test scripts/__tests__/benchmark-ai-pipeline-latency.test.ts
```

Expected: PASS.

### Task 6: Add real pipeline execution to the harness

**Files:**
- Modify: `scripts/benchmark-ai-pipeline-latency.ts`
- Read: `lib/ai/pipeline/orchestrator.ts`
- Read: `app/api/analyze-meal/route.ts`
- Read: `lib/db/index.ts`
- Read: `lib/ai/gemini.ts`

- [ ] **Step 1: Reuse existing app helpers instead of duplicating pipeline logic**

Inspect the real route and pipeline entry points:

```bash
git grep -n -E "analyzeMeal|runPipeline|createGeminiClient|db" -- app/api/analyze-meal lib/ai/pipeline lib/db
```

Expected: identify the exported pipeline function and the smallest real dependency set needed by the script.

- [ ] **Step 2: Implement benchmark execution behind a CLI guard**

Add a `main()` section to `scripts/benchmark-ai-pipeline-latency.ts` that:

1. reads `--variant=<label | all | default>`, `--runs=<number>`, `--output=<path>`, and `--compare=<left,right>`;
2. treats `--variant=all` as every variant in `LATENCY_BENCHMARK_VARIANTS`;
3. treats `--variant=default` as the app's production/default configuration with `PIPELINE_MODEL_PROFILE=stable` and no compression/schema env overrides;
4. treats `--compare=<left,right>` as an offline mode that reads two JSON result files, prints a comparison table, evaluates the latency gate, and makes no Gemini/DB calls;
5. applies only the selected variant env overrides for the process, always forcing `PIPELINE_MODEL_PROFILE=stable`;
6. applies env overrides before importing any real pipeline module because `lib/ai/pipeline/orchestrator.ts` resolves the model profile at module load;
7. keeps imports of `orchestrator.ts`, Gemini client creation, and DB client creation inside an async function that runs after env setup;
8. runs each meal once as warm-up and then `runs` measured times;
9. calls the real pipeline with the same Gemini client, DB client, and user context shape as `/api/analyze-meal`;
10. records stage timings from emitted events, trace callbacks, or existing pipeline telemetry;
11. writes newline-delimited JSON or a JSON array to the output path;
12. exits non-zero if any run fails.

Do not print env values. Do not write raw credentials. Raw meal text is allowed in the local output because the meal set is synthetic.

- [ ] **Step 3: Add a no-network dry-run mode**

Add `--dry-run` support that prints the matrix and exits without Gemini or DB calls.

Run:

```bash
bun --env-file=.env.local scripts/benchmark-ai-pipeline-latency.ts --dry-run
```

Expected: prints the five meals and five variants, no provider calls.

- [ ] **Step 4: Add tests for CLI-only modes**

Update `scripts/__tests__/benchmark-ai-pipeline-latency.test.ts` to cover:

```ts
import {
  getBenchmarkVariantsForCli,
  redactEnvForDisplay,
} from '../benchmark-ai-pipeline-latency';

describe('latency benchmark CLI helpers', () => {
  it('expands all variants', () => {
    expect(getBenchmarkVariantsForCli('all')).toHaveLength(
      LATENCY_BENCHMARK_VARIANTS.length
    );
  });

  it('supports default as a stable no-compression variant', () => {
    expect(getBenchmarkVariantsForCli('default')).toEqual([
      expect.objectContaining({
        label: 'default',
        env: expect.objectContaining({
          PIPELINE_MODEL_PROFILE: 'stable',
          PIPELINE_PROVIDER_SCHEMA_MODE: undefined,
          PIPELINE_DECOMPOSITION_PROMPT_LABEL: undefined,
          PIPELINE_NUTRITION_PROMPT_LABEL: undefined,
        }),
      }),
    ]);
  });

  it('redacts env values for display', () => {
    expect(
      redactEnvForDisplay({
        GEMINI_API_KEY: 'secret',
        PIPELINE_MODEL_PROFILE: 'stable',
      })
    ).toEqual({
      GEMINI_API_KEY: '<set>',
      PIPELINE_MODEL_PROFILE: 'stable',
    });
  });
});
```

Expected: tests describe `all`, `default`, compare helper coverage, and secret redaction behavior.

- [ ] **Step 5: Run tests after implementation**

Run:

```bash
bun run test scripts/__tests__/benchmark-ai-pipeline-latency.test.ts
```

Expected: PASS.

---

## Chunk 3: Benchmark Main, Clean Branch, And Dirty Branch

### Task 7: Benchmark clean main control

**Files:**
- Worktree: `/Users/khoivo/Documents/nham-latency-main`
- Output: `/Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-main.json`

- [ ] **Step 1: Copy or apply the benchmark harness to the main worktree without changing production code**

If the benchmark script is not present on main, copy only `scripts/benchmark-ai-pipeline-latency.ts` and its test into the main worktree for local measurement. Do not commit it there.

If the implementation split the harness into `scripts/benchmark-ai-pipeline-latency/*.ts`, copy that directory too. The complete harness file set is:

```text
scripts/benchmark-ai-pipeline-latency.ts
scripts/__tests__/benchmark-ai-pipeline-latency.test.ts
scripts/benchmark-ai-pipeline-latency/config.ts
scripts/benchmark-ai-pipeline-latency/runner.ts
```

Only the files that exist need to be copied.

- [ ] **Step 2: Verify main is using the intended model**

Run in the main worktree:

```bash
git grep -n -E "gemini-3.1-flash-lite|STABLE_PROFILE" -- lib/ai/pipeline/model-profile.ts
```

Expected: `STABLE_PROFILE` resolves to `gemini-3.1-flash-lite`. If main differs, stop and report the mismatch.

- [ ] **Step 3: Run the all-off main benchmark**

Run in the main worktree:

```bash
bun --env-file=/Users/khoivo/Documents/nham-ai-pipeline-impl/.env.local scripts/benchmark-ai-pipeline-latency.ts --variant=all-off --runs=2 --output=/Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-main.json
```

Expected: all measured runs succeed. Warm-cache p50 for normal meals should be near 8-10s.

### Task 8: Benchmark clean branch without uncommitted reliability changes

**Files:**
- Worktree: `/Users/khoivo/Documents/nham-latency-branch-clean`
- Output: `/Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-branch-clean.json`

- [ ] **Step 1: Copy or apply the benchmark harness to the clean branch worktree**

If the benchmark script is not present in the clean branch worktree, copy only:

```text
scripts/benchmark-ai-pipeline-latency.ts
scripts/__tests__/benchmark-ai-pipeline-latency.test.ts
scripts/benchmark-ai-pipeline-latency/config.ts
scripts/benchmark-ai-pipeline-latency/runner.ts
```

Only the files that exist need to be copied.

Expected: the complete benchmark harness is available locally in the clean branch worktree but remains uncommitted there.

- [ ] **Step 2: Run all branch variants**

Run in the clean branch worktree:

```bash
bun --env-file=/Users/khoivo/Documents/nham-ai-pipeline-impl/.env.local scripts/benchmark-ai-pipeline-latency.ts --variant=all --runs=2 --output=/Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-branch-clean.json
```

Expected: output contains all five variants. Failures are useful evidence; do not paper over them.

- [ ] **Step 3: Compare against main**

Run:

```bash
bun scripts/benchmark-ai-pipeline-latency.ts --compare=/Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-main.json,/Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-branch-clean.json
```

Expected: prints the first variant or stage that exceeds the 10s gate or is materially slower than main.

### Task 9: Benchmark dirty branch with reliability changes

**Files:**
- Worktree: original repo `/Users/khoivo/Documents/nham-ai-pipeline-impl`
- Output: `/Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-branch-dirty.json`

- [ ] **Step 1: Run all variants on the dirty branch**

Run:

```bash
bun --env-file=.env.local scripts/benchmark-ai-pipeline-latency.ts --variant=all --runs=2 --output=/Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-branch-dirty.json
```

Expected: output shows whether the uncommitted reliability changes improved, worsened, or did not affect latency.

- [ ] **Step 2: Compare clean and dirty branch**

Run:

```bash
bun scripts/benchmark-ai-pipeline-latency.ts --compare=/Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-branch-clean.json,/Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-branch-dirty.json
```

Expected: identifies whether the reliability patch affects total latency or only failure behavior.

---

## Chunk 4: Choose And Implement The Minimal Fix

### Task 10: Identify the measured offender

**Files:**
- Read: benchmark JSON outputs in session-state files
- Modify: no source files

- [ ] **Step 1: Build a comparison table**

Create a table in the terminal output with:

```text
worktree | variant | meal | totalMs | decompositionMs | matchingMs | nutritionMs | decompAttempts | nutritionAttempts | retryStep2Count | unmatchedCount | pass/fail
```

Expected: the slow stage and first regressing variant are visible without reading logs.

- [ ] **Step 2: Classify the regression**

Use these rules:

```text
If main all-off <= 10s and branch all-off > 10s:
  regression is outside prompt/schema flags; inspect common branch changes.
If all-off passes and slim-schema-only fails:
  schema slimming is the measured offender.
If slim-schema-only passes and compressed-decomposition-only fails:
  compressed decomposition is the measured offender.
If compressed-nutrition-only fails:
  compressed nutrition is the measured offender.
If only variants with retryStep2Count > 0 fail:
  retry/anomaly policy is the measured offender.
If matchingMs or embedding misses dominate:
  matching/cache path is the measured offender.
If provider attempts dominate with 5xx/429:
  provider retry/deadline path is the measured offender.
```

Expected: one primary offender is named. If there are multiple, select the first change in history that introduced a >25% regression.

### Task 11: Implement the smallest corrective change

**Files:**
- Modify only the file(s) implicated by Task 10.
- Add or update tests next to the implicated module.

- [ ] **Step 1: If schema slimming is the offender**

Modify `lib/ai/prompts/schema.ts` or its selector so `PIPELINE_PROVIDER_SCHEMA_MODE=slim` is not the default and cannot be enabled accidentally without explicit env.

Run:

```bash
bun run test lib/ai/prompts/__tests__/schema-slimming.test.ts
```

Expected: tests pass and default mode is full.

- [ ] **Step 2: If compressed decomposition is the offender**

Modify `lib/ai/prompts/decomposition.ts` or the prompt selector so production defaults to `production`. Keep compressed prompt behind `PIPELINE_DECOMPOSITION_PROMPT_LABEL=compressed` only if it has value for future experiments.

Run:

```bash
bun run test lib/ai/pipeline/__tests__/prompts.test.ts
```

Expected: prompt label tests pass and default remains production.

- [ ] **Step 3: If compressed nutrition is the offender**

Modify `lib/ai/prompts/nutrition.ts` or the prompt selector so production defaults to `production`. Keep compressed prompt behind `PIPELINE_NUTRITION_PROMPT_LABEL=compressed` only if it does not silently ship as default.

Run:

```bash
bun run test lib/ai/prompts/__tests__/nutrition.test.ts
```

Expected: nutrition prompt tests pass and default remains production.

- [ ] **Step 4: If retry policy is the offender**

Modify `lib/ai/pipeline/orchestrator.ts` so warning-level anomalies do not trigger a second nutrition call by default. Keep opt-in retry behavior behind `PIPELINE_RETRY_NUTRITION_WARNINGS=true`.

Run:

```bash
bun run test lib/ai/pipeline/__tests__/orchestrator-trace.test.ts
```

Expected: default warning behavior does not retry; opt-in behavior still retries.

- [ ] **Step 5: If provider deadline handling is the offender**

Modify `lib/fetch-with-timeout.ts` and/or `lib/ai/gemini.ts` so a stage has a predictable deadline and the retry loop does not start an attempt that cannot finish inside the remaining stage budget.

Run:

```bash
bun run test lib/fetch-with-timeout.test.ts lib/ai/__tests__/gemini.test.ts
```

Expected: timeout tests pass, including a non-abort-aware operation.

- [ ] **Step 6: If matching/cache is the offender**

Modify only the targeted matching helper. Prefer exact aliases or cache fixes over global threshold changes.

Run:

```bash
bun run test lib/ai/matching/__tests__/
```

Expected: matching tests pass without broad false-positive threshold changes.

### Task 12: Re-run the benchmark gate

**Files:**
- Output: `/Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-fixed.json`

- [ ] **Step 1: Run fixed branch benchmark**

Run:

```bash
bun --env-file=.env.local scripts/benchmark-ai-pipeline-latency.ts --variant=default --runs=2 --output=/Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-fixed.json
```

Expected: representative warm-cache normal meals are <= 10s or materially no slower than main local control.

- [ ] **Step 2: Run focused tests**

Run only the focused tests matching the touched source files.

Expected: all focused tests pass.

- [ ] **Step 3: Run Biome**

Run:

```bash
bunx @biomejs/biome@2.4.2 check .
```

Expected: PASS.

- [ ] **Step 4: Browser validation**

Use the already running local app if available. If no dev server is running, ask before starting `bun dev`.

Test:

```text
Phở bò tái
Bún chả Hà Nội
2 mực kho + cơm
mực kho với nước mắm đường dầu ăn và cơm trắng
```

Expected: requests complete within the latency gate for normal meals, no hidden second nutrition calls for warnings, and output quality remains plausible.

---

## Chunk 5: Handoff And Commit

### Task 13: Report the measured root cause

**Files:**
- Read: benchmark output artifacts
- Modify: none

- [ ] **Step 1: Summarize evidence**

Report:

```text
Baseline main p50:
Current branch p50:
Slowest stage:
First regressing variant/commit:
Fix applied:
Post-fix p50:
Remaining risks:
```

Expected: the user can see exactly why the branch became slow.

### Task 14: Commit only the accepted fix

**Files:**
- Stage only files intentionally changed for the fix and benchmark harness if the user wants to keep it.

- [ ] **Step 1: Inspect diff**

Run:

```bash
git --no-pager diff --stat
git --no-pager diff -- scripts/benchmark-ai-pipeline-latency.ts scripts/__tests__/benchmark-ai-pipeline-latency.test.ts
```

Expected: no unrelated files are included.

- [ ] **Step 2: Stage only exact accepted files**

Use the measured root cause to choose one concrete staging block. Do not use directory-level staging. Delete non-applicable lines before running:

```bash
# Benchmark harness kept:
git add scripts/benchmark-ai-pipeline-latency.ts scripts/__tests__/benchmark-ai-pipeline-latency.test.ts
git add scripts/benchmark-ai-pipeline-latency/config.ts scripts/benchmark-ai-pipeline-latency/runner.ts

# Retry/timeout fix accepted:
git add lib/ai/pipeline/orchestrator.ts
git add lib/ai/pipeline/__tests__/orchestrator-trace.test.ts
git add lib/fetch-with-timeout.ts
git add lib/fetch-with-timeout.test.ts

# Prompt/schema default fix accepted:
git add lib/ai/prompts/decomposition.ts
git add lib/ai/prompts/nutrition.ts
git add lib/ai/prompts/schema.ts
git add lib/ai/prompts/__tests__/nutrition.test.ts
git add lib/ai/pipeline/__tests__/prompts.test.ts
git add lib/ai/prompts/__tests__/schema-slimming.test.ts

# Matching fix accepted:
git add lib/ai/matching/aliases.ts
git add lib/ai/matching/__tests__/aliases.test.ts
```

Expected: only files relevant to the accepted fix are staged. If a listed optional file does not exist, skip that exact line. Run `git --no-pager diff --cached --stat` before committing and unstage anything unrelated with `git restore --staged -- <path>`.

- [ ] **Step 3: Commit with required trailer**

Run:

```bash
git commit -m "fix: restore meal analysis latency

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

Expected: commit succeeds only after the user approves the final file set.

### Task 15: Clean up temporary worktrees after approval

**Files:**
- Remove worktree: `/Users/khoivo/Documents/nham-latency-main`
- Remove worktree: `/Users/khoivo/Documents/nham-latency-branch-clean`

- [ ] **Step 1: Remove benchmark worktrees**

Run after all data has been captured and no uncommitted changes remain in the temporary worktrees:

```bash
git worktree remove /Users/khoivo/Documents/nham-latency-main
git worktree remove /Users/khoivo/Documents/nham-latency-branch-clean
```

Expected: temporary worktrees are removed. If Git refuses because a worktree is dirty, inspect it and preserve any benchmark output before retrying.
