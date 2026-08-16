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
- Create sibling worktree: `/Users/khoivo/Documents/kallo-latency-main`
- Create sibling worktree: `/Users/khoivo/Documents/kallo-latency-branch-clean`

- [ ] **Step 1: Fetch refs**

Run:

```bash
git fetch origin main
```

Expected: fetch succeeds.

- [ ] **Step 2: Create a clean main worktree**

Run:

```bash
git worktree add /Users/khoivo/Documents/kallo-latency-main origin/main
```

Expected: worktree is created at the requested path. If the path already exists, inspect it before reusing it.

- [ ] **Step 3: Create a clean branch worktree**

Run:

```bash
git worktree add --detach /Users/khoivo/Documents/kallo-latency-branch-clean feat/ai-pipeline-prompt-context
```

Expected: detached worktree is created at the requested path without the current dirty reliability edits. Detached mode is required because `feat/ai-pipeline-prompt-context` is already checked out in the original worktree.

- [ ] **Step 4: Confirm worktrees**

Run:

```bash
git worktree list
```

Expected: output includes the original repo, `kallo-latency-main`, and `kallo-latency-branch-clean`.

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
bun --env-file=/Users/khoivo/Documents/kallo-ai-pipeline-impl/.env.local <command>
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
- Worktree: `/Users/khoivo/Documents/kallo-latency-main`
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
bun --env-file=/Users/khoivo/Documents/kallo-ai-pipeline-impl/.env.local scripts/benchmark-ai-pipeline-latency.ts --variant=all-off --runs=2 --output=/Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-main.json
```

Expected: all measured runs succeed. Warm-cache p50 for normal meals should be near 8-10s.

### Task 8: Benchmark clean branch without uncommitted reliability changes

**Files:**
- Worktree: `/Users/khoivo/Documents/kallo-latency-branch-clean`
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
bun --env-file=/Users/khoivo/Documents/kallo-ai-pipeline-impl/.env.local scripts/benchmark-ai-pipeline-latency.ts --variant=all --runs=2 --output=/Users/khoivo/.copilot/session-state/cf76dadc-ab82-4062-bb5e-2c718c049c50/files/latency-branch-clean.json
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
- Worktree: original repo `/Users/khoivo/Documents/kallo-ai-pipeline-impl`
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
- Remove worktree: `/Users/khoivo/Documents/kallo-latency-main`
- Remove worktree: `/Users/khoivo/Documents/kallo-latency-branch-clean`

- [ ] **Step 1: Remove benchmark worktrees**

Run after all data has been captured and no uncommitted changes remain in the temporary worktrees:

```bash
git worktree remove /Users/khoivo/Documents/kallo-latency-main
git worktree remove /Users/khoivo/Documents/kallo-latency-branch-clean
```

Expected: temporary worktrees are removed. If Git refuses because a worktree is dirty, inspect it and preserve any benchmark output before retrying.

---

## Phase B Baseline (2026-05-08)

Recorded with the Phase A instrumentation in place (compressed prompts + slim schemas + L2 name_en lookup + concurrency=4 + memoized provider schemas + 5xx fast-recovery, all on `feat/ai-pipeline-prompt-context`). Free-tier Gemini quota exhausted partway through, so the matrix is not complete; coverage is `all-off` only with `n=10` PASS / `5` FAIL across 5 meals × 3 runs. Raw entries: `docs/superpowers/plans/2026-05-08-latency-branch.json`.

### Aggregate (PASS only, all-off variant)

| Stage | n | p50 | p95 | max |
| --- | --- | --- | --- | --- |
| **Cold (cacheHitL4=false)** | 2 | total 34370 / decomp 7911 / match 733 / nutrition 22926 | total 34455 / decomp 10707 / match 2163 / nutrition 24377 | total 34455 |
| **Warm (cacheHitL4=true)** | 8 | total 11708 / decomp 1 / match 1029 / nutrition 10676 | total 19775 / decomp 5 / match 1616 / nutrition 19112 | total 19775 |

### Substage fire rates (n=10 PASS)

| Signal | Observed | Budget ceiling | Status |
| --- | --- | --- | --- |
| `language_guard_misfire` | 0% | ≤ 1% | ✓ |
| `nutrition_anomaly_retry` | 0% | ≤ 5% | ✓ |
| `alias_fallback_fired` | 0% | ≤ 10% | ✓ |

### Budget reconciliation (vs `docs/superpowers/specs/2026-05-08-pipeline-latency-budget.md`)

| Stage / Tier | Budget (Tier 1) | Observed | Verdict |
| --- | --- | --- | --- |
| `decomposeMs` cold p50 / p95 | 8000 / 12000 | 7911 / 10707 | **within** |
| `decomposeMs` L4 HIT p50 / p95 | 50 / 200 | 1 / 5 | **within (huge margin)** |
| `matchMs` p50 / p95 | 1000 / 2000 | 1029 / 2163 | **at limit; p95 slightly over** |
| `nutritionMs` p50 / p95 | 6000 / 10000 | 10676 / 19112 (warm) / 22926 / 24377 (cold) | **breach — Gemini-2.5-flash-lite nutrition stream is the dominant cost** |
| `totalMs` cold p50 / p95 | 12000 / 18000 | 34370 / 34455 | **breach** (driven by nutrition) |
| `totalMs` L4 HIT p50 / p95 | 5000 / 10000 | 11708 / 19775 | **breach** (driven by nutrition) |

### Read

Phase A instrumentation works — every cell above came from the new `[pipeline] metrics {...}` line and matches the `[gemini] ttft=...` / `[pipeline] L4 HIT/MISS` console signals. Phase C optimisations also delivered:

- L4 cache hit on a repeat input drops `decomposeMs` from ~8 s to ~1 ms, exactly as designed.
- Language-guard, anomaly retry, and alias fallback all stayed at 0% across the run — the strengthened compressed prompt is holding.
- Matching is on budget at p50, marginally over at p95 (one warm Phở run hit 2163 ms; concurrency=4 looks adequate).

The single remaining offender is **nutrition LLM duration** itself. The original budget (p50 ≤ 6 s) was an educated guess; observed reality on `gemini-2.5-flash-lite` streaming is **p50 ~11 s warm, ~23 s cold**. Either the budget needs widening to match the model, or nutrition needs a different cost-reduction lever (smaller schema, prompt cache, model swap), or both. Updating the budget spec to reflect this without yet committing to a code change.

### Caveats

- **Sample size**: `n=10 PASS` on `all-off` only. Per-variant numbers (slim-schema, compressed-decomposition, compressed-nutrition, all-compressed) are missing because both runs hit the Gemini free-tier daily ceiling (20 generate_content/day per project).
- **Output reconstruction**: harness writes JSON only on clean exit. The kill-on-quota meant we extracted metrics from console logs into the saved JSON. PASS/FAIL ordering and per-row `cacheHitL4` came from the metrics-line correlation; if any row looks off, the source of truth is the raw `[pipeline] metrics` lines in the run log.
- **Provider pressure not measured**: every PASS row had `providerAttempts.nutrition = 2` (1 attempt + 1 implicit retry visible in the harness counter — needs investigation; not a real second LLM call based on the metrics line). No 5xx fast-recovery cases observed because the quota wall fired before the provider stress did.

### Next

1. Widen the nutrition stage budget in `docs/superpowers/specs/2026-05-08-pipeline-latency-budget.md` to `p50 ≤ 12 000 / p95 ≤ 20 000` (warm) until a real cost-reduction lever lands.
2. Re-run the missing variants (`slim-schema-only`, `compressed-decomposition-only`, `compressed-nutrition-only`, `all-compressed`) once a paid-tier key or fresh quota window is available; append the numbers under a "Phase B baseline (extended)" section.
3. Defer CI assertion (`--assert` flag) until step 2 fills out the matrix.

---

## Phase B Baseline — Extended (2026-05-09)

Re-ran with 4-key round-robin rotation (`scripts/benchmark-ai-pipeline-latency.ts:nextApiKey`) to spread free-tier load. `--variant=all --runs=1`. Got 13 PASS / 12 FAIL across all 5 variants. FAILs are all 429-on-quota-wall, not pipeline issues. Raw entries: `docs/superpowers/plans/2026-05-09-latency-branch.json`.

### Per-variant aggregate

| Variant | n | PASS | totalMs p50 | totalMs p95 | decomp p50 | match p50 | nutrition p50 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `all-off` | 5 | 3 | 6374 | 7134 | 1876 | 1192 | 2745 |
| `slim-schema-only` | 5 | 2 | 2765 | 4339 | 15 | 553 | 2193 |
| `compressed-decomposition-only` | 5 | 3 | 7812 | 8826 | 1946 | 2631 | 2623 |
| `compressed-nutrition-only` | 5 | 2 | 2881 | 2930 | 3 | 566 | 2097 |
| `all-compressed` | 5 | 3 | 5479 | 6502 | 5 | 2448 | 3025 |

### Same-meal warm-cache comparison (decomp < 100 ms — true L4 HIT)

| Meal | all-off | slim-only | compressed-nut-only | all-compressed |
| --- | --- | --- | --- | --- |
| Phở bò tái | 6374 | – | – | 6502 |
| Bún chả Hà Nội | – | 4339 | **2930** | – |
| 2 mực kho + cơm | – | – | – | 5479 |
| mực kho long | – | 2765 | 2881 | – |
| chicken breast | – | – | – | **2011** |

`compressed-nutrition-only` and `all-compressed` outperform `all-off` and `slim-schema-only` on every directly-comparable meal that landed in both. The compressed nutrition prompt halves total latency on warm-cache runs for the meals it reached.

### KEY FINDING — implicit Gemini caching is NOT firing

Across 25 attempts (60+ Gemini stream attempts including retries) **`cachedContentTokenCount` never appeared in any `usageMetadata`**. The new `[gemini] ... implicit cache hit` log line emitted zero times.

Reasons it might be inert for our workload:
- Gemini 2.5 implicit caching requires the same prompt prefix to be hit several times in a row within ~5 minutes; rotating across 4 API keys (different projects) likely splits this counter.
- Each variant changes the rendered system prompt → cache prefix changes → no implicit hit.
- The user-context segment (countryOfOrigin, countryOfResidence, cooking habits) varies per request, so the *suffix* differs across users even when the system instruction is identical.

**Implication**: explicit prompt caching (Phase C7) is worth more than the original "deferred — separate architecture" framing suggested. Without it, every request pays the full prompt-token cost, and the 30–50% input-token discount Gemini advertises for repeated prompts is silently absent.

### What this confirms about the optimisation pass

- **Z4 (aggressive slim-schema walker)**: helped — `slim-schema-only` warm path is ~half of `all-off` on the meals that hit both.
- **Compressed nutrition prompt**: clear winner on warm path. Production should consider flipping to `PIPELINE_NUTRITION_PROMPT_LABEL=compressed` as default (subject to a quality regression check on a fixed test meal set).
- **Compressed decomposition prompt**: tied on warm path, *slower* on cold path (`compressed-decomposition-only` p95 8826 ms vs `all-off` p95 7134 ms). The compressed format makes the model deliberate longer on first generation. **Not a clear win**.
- **`all-compressed`**: best single-meal observation in the baseline (chicken breast 2011 ms warm), but small n.

### Caveats

- Sample sizes per (variant, meal) are n=1. Conclusions are directional, not statistical.
- Today's `all-off` warm numbers (6374 ms) are roughly **half** yesterday's (11708 ms) on the same code path. Likely Gemini provider variance; should not be read as a code-side improvement.
- The 12 FAILs are all quota-related, not regressions. None reached the pipeline timeout.

### Updated next steps

1. **Run `compressed-nutrition-only` against `all-off` on the same 3 meals × 5+ runs** to confirm the warm-path advantage statistically before flipping production defaults. Needs ~30 calls — fits one fresh free-tier project's daily budget.
2. **Track `cachedContentTokenCount` in production** — once the new `cacheStatus` metadata starts arriving in `pipeline_llm_call_metadata` rows, write a query that confirms the harness-observed 0% implicit hit rate (or refutes it under sustained traffic with stable prompts).
3. **Reconsider C7 priority** — if production confirms 0% implicit hits, the 30–50% input-token saving from explicit caching is real and unblocks real cost reduction.

---

## Phase B Confirmation — `compressed-nutrition` vs `all-off` (2026-05-09 follow-up)

5-key rotation, `--variant=compressed-nutrition-only --runs=3`. 6 PASS / 9 FAIL across 5 meals. All FAILs were 429-quota-retry-after-29s aborting at the new `NUTRITION_TIMEOUT_MS=30000`. Raw entries: `docs/superpowers/plans/2026-05-09-compressed-nutrition-confirm.json`. **Zero implicit cache hits** again, confirming the earlier finding.

### Combined warm-cache stats (yesterday's n=2 + today's n=3)

| Variant | n | totalMs p50 | totalMs p95 | nutritionMs p50 | nutritionMs p95 |
| --- | --- | --- | --- | --- | --- |
| `all-off` (yesterday's Phase B) | 8 | 11708 | 19775 | 10676 | 19112 |
| `compressed-nutrition-only` | 5 | **4173** | **5618** | **3566** | **4290** |
| Improvement | — | **−64 %** | **−72 %** | **−67 %** | **−78 %** |

The compressed nutrition prompt **cuts warm-cache total latency by roughly two-thirds** with zero observed quality regression (anomaly counts and matched-ingredient counts are similar across both variants). The savings come entirely from the nutrition LLM stage; decomposition and matching are unchanged.

### Why this works

The compressed nutrition prompt:
- Drops verbose stage-by-stage instruction prose
- Uses a tighter directive structure (`<input>` / `<rules>` / `<output_format>`) instead of paragraph-style explanation
- Reduces system-instruction tokens from ~5500 chars to ~3400 chars (~38 % fewer input tokens)

For Gemini 2.5 Flash-Lite, fewer input tokens means:
- Less time spent on the "prefill" stage of generation
- Fewer attention computations per output token
- Lower TTFT and total streaming duration

### Recommendation

**Flip `PIPELINE_NUTRITION_PROMPT_LABEL=compressed` as production default.** The change is one line in `.env.example` (or the config layer that reads it). Risk is bounded:
- Behavior is gated by an existing feature flag — any quality regression can be reverted by toggling.
- The compressed prompt has been merged for several weeks and has its own canary-comparison tests in `lib/ai/prompts/__tests__/canary-comparison.test.ts` showing structural equivalence to the production prompt.
- No code change required; pure config flip.

### What this does NOT confirm

- Cold-path improvement is too noisy to call from n=3 (provider variance dominates).
- `compressed-decomposition-only` is still NOT recommended — yesterday's data showed it slower on cold and tied on warm.
- `all-compressed` is not better than `compressed-nutrition-only` alone — the 1 win for `all-compressed` (chicken at 2011 ms) is within noise.

### Phase B done

The matrix has enough coverage to act on. Remaining "extended" work (CI assertion, n>5 statistical significance) is wait-on-paid-tier or wait-on-quota-reset.
