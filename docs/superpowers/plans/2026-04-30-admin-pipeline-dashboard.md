# Admin Pipeline Dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a secured admin dashboard that surfaces full per-stage traces, prompt-version history, and replay for the four-stage AI meal-analysis pipeline so the developer can diagnose edge cases and iterate on prompts.

**Architecture:** Drizzle schema additions (3 new tables + 2 columns on `pipeline_requests`) + a new `lib/ai/pipeline/trace.ts` instrumentation module that the orchestrator and Gemini client call into via an optional `traceContext`. Admin routes live under `/admin/*` (outside the `[locale]` segment), gated by an `ADMIN_EMAILS` env allowlist enforced server-side via `requireAdmin()`. Replay bypasses the API route entirely so the orchestrator stays pure.

**Tech Stack:** Next.js App Router, Drizzle ORM (postgres-js), Supabase auth, shadcn/ui, Tailwind, TanStack Query (only where client-side fetching is needed), Vitest, Biome 2.4.2, `diff` npm package for prompt diffing.

**Spec:** `docs/superpowers/specs/2026-04-30-admin-pipeline-dashboard-design.md`

**Worktree:** `/Users/khoivo/Documents/kallo-admin-dashboard` on `feat/admin-pipeline-dashboard`.

**Conventions to follow** (from `AGENTS.md`):
- Run lint/format with `bunx @biomejs/biome@2.4.2 check .` (and `--write` to fix).
- Run tests with `bun run test`.
- Never edit `package.json` manually — use `bun add <pkg>`.
- Never edit `components/ui/*` — use `bunx shadcn@latest add <component>`.
- Schema lives in `lib/db/schema.ts`. Generate migrations with `bun db:generate`. **Rename the generated migration filename meaningfully** in both the SQL filename and `meta/_journal.json` `tag` field.
- User runs `bun dbr:push` (do NOT run it).
- Validate external inputs with Zod.
- No `useEffect` for data fetching, no native `alert`/`confirm`/`prompt`, no non-Lucide icons, no emoji in UI code.
- Conventional Commits. Co-author trailer required:

  ```
  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
  ```

---

## Chunk 1: Schema + Migration

**Goal:** Land the three new tables and two new columns on `pipeline_requests`. Migration must be applied (by user) before any instrumentation code can run.

### Task 1.1: Extend `lib/db/schema.ts` with new tables

**Files:**
- Modify: `lib/db/schema.ts` (append to end, before any export aggregation; or in section adjacent to existing `pipelineRequests` near line 419)

- [ ] **Step 1: Read current `pipeline_requests` definition**

Run: `view lib/db/schema.ts` around line 419 to confirm column types and the imports already present (`pgTable`, `uuid`, `text`, `jsonb`, `timestamp`, `integer`, `index`, `check`, `unique`, `sql`, `foreignKey`).

- [ ] **Step 2: Add `promptVersions` table**

Append to `lib/db/schema.ts`:

```ts
export const promptVersions = pgTable(
  'prompt_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    codeHash: text('code_hash').notNull(),
    templateSample: text('template_sample').notNull(),
    model: text('model').notNull(),
    gitSha: text('git_sha'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('prompt_versions_name_hash_uq').on(t.name, t.codeHash),
    index('prompt_versions_name_first_seen_idx').on(
      t.name,
      sql`${t.firstSeenAt} DESC`,
    ),
  ],
);
```

- [ ] **Step 3: Add `pipelineStageLogs` table**

```ts
export const pipelineStageLogs = pgTable(
  'pipeline_stage_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => pipelineRequests.id, { onDelete: 'cascade' }),
    stage: text('stage').notNull(),
    stageIndex: integer('stage_index').notNull(),
    inputJson: jsonb('input_json'),
    outputJson: jsonb('output_json'),
    status: text('status').notNull(),
    error: text('error'),
    durationMs: integer('duration_ms').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      'pipeline_stage_logs_stage_chk',
      sql`${t.stage} IN ('decomposition','matching','nutrition','assembly')`,
    ),
    check(
      'pipeline_stage_logs_status_chk',
      sql`${t.status} IN ('success','error','skipped')`,
    ),
    index('pipeline_stage_logs_req_idx').on(t.requestId, t.stageIndex),
  ],
);
```

- [ ] **Step 4: Add `pipelineLlmCalls` table**

```ts
export const pipelineLlmCalls = pgTable(
  'pipeline_llm_calls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => pipelineRequests.id, { onDelete: 'cascade' }),
    stageLogId: uuid('stage_log_id').notNull(), // intentionally NOT a FK; see spec §5.3
    promptVersionId: uuid('prompt_version_id')
      .notNull()
      .references(() => promptVersions.id),
    model: text('model').notNull(),
    promptRendered: text('prompt_rendered').notNull(),
    responseRaw: text('response_raw'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    latencyMs: integer('latency_ms').notNull(),
    attempt: integer('attempt').notNull().default(1),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('pipeline_llm_calls_req_idx').on(t.requestId),
    index('pipeline_llm_calls_pv_idx').on(t.promptVersionId),
    index('pipeline_llm_calls_stage_log_idx').on(t.stageLogId),
  ],
);
```

- [ ] **Step 5: Extend `pipelineRequests` with two columns**

In the existing `pipelineRequests` definition, add:

```ts
promptVersionsUsed: jsonb('prompt_versions_used'),
replayOfRequestId: uuid('replay_of_request_id'),
```

Then add a self-FK constraint via the table extras callback (use `foreignKey` from drizzle-orm/pg-core and `.onDelete('set null')`):

```ts
foreignKey({
  columns: [t.replayOfRequestId],
  foreignColumns: [t.id],
  name: 'pipeline_requests_replay_of_fk',
}).onDelete('set null'),
```

- [ ] **Step 6: Type-check**

Run: `bunx tsc --noEmit`
Expected: no errors. Fix any drizzle type complaints (commonly missing imports for `unique`, `check`, `foreignKey`).

- [ ] **Step 7: Generate migration**

Run: `bun db:generate`
Expected: a new file `supabase/migrations/<timestamp>_<random>.sql` and updates to `supabase/migrations/meta/_journal.json` and `meta/<n>_snapshot.json`.

- [ ] **Step 8: Rename migration meaningfully**

Pick a name: `add_admin_pipeline_trace_tables`.
1. `mv supabase/migrations/<timestamp>_<random>.sql supabase/migrations/<timestamp>_add_admin_pipeline_trace_tables.sql`
2. Edit `supabase/migrations/meta/_journal.json`: change the `tag` field for the new entry from `<timestamp>_<random>` to `<timestamp>_add_admin_pipeline_trace_tables`.

- [ ] **Step 9: Inspect generated SQL**

`view supabase/migrations/<timestamp>_add_admin_pipeline_trace_tables.sql`. Confirm:
- All three CREATE TABLE statements present.
- Self-FK on `pipeline_requests.replay_of_request_id` with `ON DELETE SET NULL`.
- CHECK constraints on `pipeline_stage_logs.stage` and `.status`.
- No FK from `pipeline_llm_calls.stage_log_id`.

- [ ] **Step 10: Commit**

```bash
git add lib/db/schema.ts supabase/migrations/
git commit -m "feat(db): add admin pipeline trace tables

prompt_versions, pipeline_stage_logs, pipeline_llm_calls and the
prompt_versions_used / replay_of_request_id columns on
pipeline_requests. See docs/superpowers/specs/2026-04-30-admin-pipeline-dashboard-design.md.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

- [ ] **Step 11: Hand off to user**

Ask the user to run `bun dbr:push` against staging and report `bun dbr:status`. Do NOT proceed to chunk 2 instrumentation tests until migration is applied (tests may write to these tables).

---

## Chunk 2: `requireAdmin` + middleware bypass + admin shell

**Goal:** A request to `/admin/*` from a non-admin returns 404; from an admin renders a placeholder layout with a sidebar.

### Task 2.1: `requireAdmin` helper + tests

**Files:**
- Create: `lib/admin/require-admin.ts`
- Create: `lib/admin/__tests__/require-admin.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/admin/__tests__/require-admin.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the supabase server client BEFORE importing the SUT
const getUser = vi.fn();
vi.mock('@/lib/infra/supabase/server', () => ({
  createClient: () => ({ auth: { getUser } }),
}));

// notFound is thrown by next/navigation
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import { requireAdmin } from '../require-admin';

describe('requireAdmin', () => {
  beforeEach(() => {
    vi.resetModules();
    getUser.mockReset();
    delete process.env.ADMIN_EMAILS;
  });

  it('returns the user when email is in allowlist (case-insensitive, trimmed)', async () => {
    process.env.ADMIN_EMAILS = ' Admin@Example.com , other@x.com ';
    getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'admin@example.com' } },
      error: null,
    });
    const u = await requireAdmin();
    expect(u.email).toBe('admin@example.com');
  });

  it('notFound when no session', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com';
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireAdmin()).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('notFound when env is empty', async () => {
    process.env.ADMIN_EMAILS = '';
    getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'admin@example.com' } },
      error: null,
    });
    await expect(requireAdmin()).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('notFound when env is missing', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'admin@example.com' } },
      error: null,
    });
    await expect(requireAdmin()).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('notFound when email not in allowlist', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com';
    getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'someone@else.com' } },
      error: null,
    });
    await expect(requireAdmin()).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
```

- [ ] **Step 2: Run tests; expect failure**

Run: `bun run test lib/admin/__tests__/require-admin.test.ts`
Expected: FAIL — module `../require-admin` not found.

- [ ] **Step 3: Implement `lib/admin/require-admin.ts`**

```ts
import 'server-only';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/infra/supabase/server';

export interface AdminUser {
  id: string;
  email: string;
}

function adminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function requireAdmin(): Promise<AdminUser> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  const email = user?.email?.toLowerCase();
  if (!user || !email) notFound();
  const allow = adminEmails();
  if (allow.size === 0) notFound();
  if (!allow.has(email)) notFound();
  return { id: user.id, email };
}
```

- [ ] **Step 4: Run tests; expect pass**

Run: `bun run test lib/admin/__tests__/require-admin.test.ts`
Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/
git commit -m "feat(admin): add requireAdmin server helper

Env-var allowlist (ADMIN_EMAILS) gate. Calls notFound() on failure.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 2.2: Middleware bypass for `/admin/*`

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Inspect current middleware**

`view middleware.ts`. It composes `intlMiddleware` then `updateSession`.

- [ ] **Step 2: Add early-return branch**

Replace the function body with:

```ts
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/admin')) {
    return await updateSession(request, NextResponse.next());
  }
  const intlResponse = intlMiddleware(request);
  return await updateSession(request, intlResponse);
}
```

Add `NextResponse` to the existing `next/server` import if not already there.

- [ ] **Step 3: Manual smoke**

`bunx tsc --noEmit` — expect clean.

- [ ] **Step 4: Commit**

```bash
git add middleware.ts
git commit -m "feat(middleware): bypass next-intl for /admin/*

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 2.3: Admin shell layout

**Files:**
- Create: `app/admin/layout.tsx`
- Create: `app/admin/page.tsx`
- Create: `app/admin/_components/admin-sidebar.tsx`

- [ ] **Step 1: `app/admin/layout.tsx`**

```tsx
import { requireAdmin } from '@/lib/admin/require-admin';
import { AdminSidebar } from './_components/admin-sidebar';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1">
        <header className="flex h-12 items-center justify-between border-b px-4 text-sm text-muted-foreground">
          <span>Admin</span>
          <span>{admin.email}</span>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `app/admin/page.tsx`**

```tsx
import { redirect } from 'next/navigation';
export default function AdminIndex() {
  redirect('/admin/requests');
}
```

- [ ] **Step 3: `app/admin/_components/admin-sidebar.tsx`** — server component, plain `<a>` tags (no next-intl `Link`):

```tsx
const items = [
  { href: '/admin/requests', label: 'Requests' },
  { href: '/admin/prompts', label: 'Prompts' },
  { href: '/admin/health', label: 'Health' },
];

export function AdminSidebar() {
  return (
    <nav className="w-48 border-r p-4">
      <ul className="space-y-1 text-sm">
        {items.map((it) => (
          <li key={it.href}>
            <a className="block rounded px-2 py-1 hover:bg-muted" href={it.href}>
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/admin/
git commit -m "feat(admin): admin shell layout and index redirect

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Chunk 3: `trace.ts` instrumentation module

**Goal:** Standalone module callable by orchestrator + Gemini client. Fully tested in isolation. **Prereq: chunk 1 migration applied.**

### Task 3.1: `lib/ai/pipeline/trace.ts` + tests

**Files:**
- Create: `lib/ai/pipeline/trace.ts`
- Create: `lib/ai/pipeline/__tests__/trace.test.ts`

- [ ] **Step 1: Write failing tests**

Cover:
- `recordPromptVersion` returns same id for identical (name, hash); only one INSERT after the first.
- Returns `null` on DB failure; subsequent calls retry (no negative cache).
- `logStage` returns the supplied `stageLogId` synchronously and fires INSERT.
- `logStage` / `logLlmCall` swallow DB errors and `console.error`.
- `PIPELINE_TRACE_ENABLED=false` → all helpers no-op (no DB calls, no `console.error`).
- Cache keyed by `(name, hash)` not by `name` alone.

Mock the drizzle `db` argument with a stub that exposes `insert(table).values(v).onConflictDoNothing().returning()` for `prompt_versions` and `insert(table).values(v)` for the others.

- [ ] **Step 2: Run; expect FAIL**

`bun run test lib/ai/pipeline/__tests__/trace.test.ts`

- [ ] **Step 3: Implement `lib/ai/pipeline/trace.ts`**

```ts
import 'server-only';
import { createHash } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import {
  promptVersions,
  pipelineStageLogs,
  pipelineLlmCalls,
} from '@/lib/infra/db/schema';
import type { AppDb } from '@/lib/infra/db/client';

const enabled = () => process.env.PIPELINE_TRACE_ENABLED !== 'false';
const cache = new Map<string, string>(); // `${name}:${hash}` -> id

export function hashPromptBuilder(builder: (...a: unknown[]) => string): string {
  return createHash('sha256').update(builder.toString()).digest('hex');
}

export async function recordPromptVersion(args: {
  db: AppDb;
  name: string;
  builder: (...a: unknown[]) => string;
  templateSample: string;
  model: string;
}): Promise<string | null> {
  if (!enabled()) return null;
  const codeHash = hashPromptBuilder(args.builder);
  const key = `${args.name}:${codeHash}`;
  const cached = cache.get(key);
  if (cached) return cached;
  try {
    const inserted = await args.db
      .insert(promptVersions)
      .values({
        name: args.name,
        codeHash,
        templateSample: args.templateSample,
        model: args.model,
        gitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      })
      .onConflictDoNothing({ target: [promptVersions.name, promptVersions.codeHash] })
      .returning({ id: promptVersions.id });
    let id = inserted[0]?.id;
    if (!id) {
      const found = await args.db
        .select({ id: promptVersions.id })
        .from(promptVersions)
        .where(
          and(
            eq(promptVersions.name, args.name),
            eq(promptVersions.codeHash, codeHash),
          ),
        )
        .limit(1);
      id = found[0]?.id;
    }
    if (id) cache.set(key, id);
    return id ?? null;
  } catch (e) {
    console.error('[trace] recordPromptVersion failed', e);
    return null;
  }
}

export interface StageLogArgs {
  db: AppDb;
  requestId: string;
  stageLogId: string;
  stage: 'decomposition' | 'matching' | 'nutrition' | 'assembly';
  stageIndex: number;
  inputJson: unknown;
  outputJson: unknown;
  status: 'success' | 'error' | 'skipped';
  error?: string;
  durationMs: number;
}

export function logStage(a: StageLogArgs): void {
  if (!enabled()) return;
  void a.db
    .insert(pipelineStageLogs)
    .values({
      id: a.stageLogId,
      requestId: a.requestId,
      stage: a.stage,
      stageIndex: a.stageIndex,
      inputJson: a.inputJson as object,
      outputJson: a.outputJson as object,
      status: a.status,
      error: a.error ?? null,
      durationMs: a.durationMs,
    })
    .catch((e) => console.error('[trace] logStage failed', e));
}

export interface LlmCallArgs {
  db: AppDb;
  requestId: string;
  stageLogId: string;
  promptVersionId: string;
  model: string;
  promptRendered: string;
  responseRaw: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  attempt: number;
  error?: string;
}

export function logLlmCall(a: LlmCallArgs): void {
  if (!enabled()) return;
  void a.db
    .insert(pipelineLlmCalls)
    .values({
      requestId: a.requestId,
      stageLogId: a.stageLogId,
      promptVersionId: a.promptVersionId,
      model: a.model,
      promptRendered: a.promptRendered,
      responseRaw: a.responseRaw,
      inputTokens: a.inputTokens,
      outputTokens: a.outputTokens,
      latencyMs: a.latencyMs,
      attempt: a.attempt,
      error: a.error ?? null,
    })
    .catch((e) => console.error('[trace] logLlmCall failed', e));
}

// Test-only escape hatch.
export function _resetPromptVersionCacheForTests() {
  cache.clear();
}
```

- [ ] **Step 4: Run; expect PASS**

`bun run test lib/ai/pipeline/__tests__/trace.test.ts`. Iterate until green.

- [ ] **Step 5: Lint**

`bunx @biomejs/biome@2.4.2 check --write lib/ai/pipeline/`

- [ ] **Step 6: Commit**

```bash
git add lib/ai/pipeline/trace.ts lib/ai/pipeline/__tests__/trace.test.ts
git commit -m "feat(pipeline): add trace.ts instrumentation helpers

Fire-and-forget logging of prompt versions, stage I/O and LLM calls
gated by PIPELINE_TRACE_ENABLED.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Chunk 4: Orchestrator + Gemini client traceContext refactor

**Goal:** Plumb optional `traceContext` through `analyzeMeal` and `GeminiClient`. Existing call sites continue to work without traceContext (no-op path).

### Task 4.1: Extend `GeminiClient` with optional `trace`

**Files:**
- Modify: `lib/ai/gemini.ts` (`generateStructuredOutputStream` ~line 198, `withRetry` closure ~line 118, `generateStructuredOutput` if present)
- Modify or create: `lib/ai/__tests__/gemini.test.ts` for trace-emit tests

The actual factory in `lib/ai/gemini.ts` is `createGeminiClient(apiKey, retryOptions?)`. `withRetry` is a closure inside it whose `fn` parameter takes no arguments today and is shared by both `generateStructuredOutputStream` *and* the embedding code path. We must NOT change `withRetry`'s signature in a way that breaks the embedding caller.

- [ ] **Step 1: Read current `withRetry` + both LLM call paths**

`view lib/ai/gemini.ts` lines 100–260. Confirm:
- `withRetry<T>(fn: () => Promise<T>, opts?): Promise<T>` returns final value only, swallowing per-attempt info.
- Both `generateStructuredOutputStream` and the embedding helper call it.

- [ ] **Step 2: Define a `GeminiCallTrace` interface (test first)**

Write a failing test in `lib/ai/__tests__/gemini.test.ts` that:
- Constructs a client with a mocked SDK whose stream yields one chunk and `usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 }`.
- Calls `client.generateStructuredOutputStream(args, { trace: { db, requestId, stageLogId, promptVersionId, promptRendered } })`.
- Asserts the stub `db` received one `pipeline_llm_calls` insert with `attempt: 1`, `inputTokens: 10`, `outputTokens: 20`, `error: null`.
- A second test where the SDK throws on the first attempt and succeeds on the second → two inserts (attempt 1 with `error`, attempt 2 with success).

Run: `bun run test lib/ai/__tests__/gemini.test.ts` — expect FAIL (interface not present).

- [ ] **Step 3: Define and export the interface**

```ts
import type { AppDb } from '@/lib/infra/db/client';

export interface GeminiCallTrace {
  db: AppDb;
  requestId: string;
  stageLogId: string;
  promptVersionId: string;
  promptRendered: string;
}
```

- [ ] **Step 4: Refactor `withRetry` signature additively (does NOT break embedding caller)**

Change to:

```ts
async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts?: { onAttempt?: (attempt: number, t0: number, result: T | null, err: unknown) => void },
): Promise<T> { /* ... */ }
```

The embedding caller currently passes `() => embed(...)` — that still type-checks because `(attempt: number) => Promise<T>` is assignable from `() => Promise<T>` only if we make `attempt` optional. Use `(attempt?: number) => Promise<T>` instead, or wrap with `(_attempt) => embed(...)` at the embedding callsite. Pick the second approach (explicit) and update the embedding callsite in this same task.

Inside the loop: capture `t0 = Date.now()` per iteration; on success or caught error, call `opts?.onAttempt(attempt, t0, result, err)`. The retry/backoff/throw logic is unchanged.

- [ ] **Step 5: Wire `trace?` into `generateStructuredOutputStream`**

Add `trace?: GeminiCallTrace` to its options. Inside, build an `onAttempt` that calls `logLlmCall(...)` with token counts captured from the consumed stream (`usageMetadata` accumulated as the stream is read; mutable closure variable). Pass that `onAttempt` to `withRetry`. When `trace` is undefined, omit `onAttempt` entirely (zero overhead).

- [ ] **Step 6: Same treatment for `generateStructuredOutput` (non-streaming) if it exists**

- [ ] **Step 7: Run; iterate to green**

`bun run test lib/ai/__tests__/gemini.test.ts` — expect PASS. Then run `bun run test lib/ai/` to confirm embedding tests still pass.

- [ ] **Step 8: Commit**

```bash
git add lib/ai/gemini.ts lib/ai/__tests__/
git commit -m "feat(gemini): optional trace param logs each LLM attempt

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 4.2: Extend `analyzeMeal` with `traceContext`

**Files:**
- Modify: `lib/ai/pipeline/orchestrator.ts`
- Create: `lib/ai/pipeline/__tests__/orchestrator-trace.test.ts`

- [ ] **Step 1: Add interface + signature**

```ts
export interface AnalyzeMealTraceContext {
  requestId: string;
  db: AppDb;
  /** Mutable holder; populated by each LLM stage as its prompt version resolves. */
  promptVersionsUsed: Map<string, string>;
}

export async function analyzeMeal(
  rawInput: string,
  userContext: UserContext,
  db: AppDb,
  gemini: GeminiClient,
  onEvent: PipelineEventHandler,
  traceContext?: AnalyzeMealTraceContext,
) { /* ... */ }
```

- [ ] **Step 2: Add a local `withStageLog` helper inside the orchestrator**

```ts
async function withStageLog<T>(
  trace: AnalyzeMealTraceContext | undefined,
  stage: StageName,
  stageIndex: number,
  inputJson: unknown,
  fn: (ctx: { stageLogId: string }) => Promise<T>,
): Promise<T> {
  if (!trace) return fn({ stageLogId: '' });
  const stageLogId = crypto.randomUUID();
  const t0 = Date.now();
  try {
    const result = await fn({ stageLogId });
    logStage({
      db: trace.db,
      requestId: trace.requestId,
      stageLogId,
      stage,
      stageIndex,
      inputJson,
      outputJson: result,
      status: 'success',
      durationMs: Date.now() - t0,
    });
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logStage({
      db: trace.db,
      requestId: trace.requestId,
      stageLogId,
      stage,
      stageIndex,
      inputJson,
      outputJson: null,
      status: 'error',
      error: message,
      durationMs: Date.now() - t0,
    });
    throw e;
  }
}
```

- [ ] **Step 3: Wrap each of the four stages**

For decomposition (1) and nutrition (3): inside the `fn`, after building the prompt, call `recordPromptVersion(...)`, store in `traceContext.promptVersionsUsed`, then call the gemini method passing a `trace` argument with `{ db, requestId, stageLogId, promptVersionId, promptRendered }`.

For matching (2) and assembly (4): just wrap with `withStageLog`; no LLM call.

- [ ] **Step 4: Tests**

`lib/ai/pipeline/__tests__/orchestrator-trace.test.ts`:
- With `traceContext`: 4 stage_log inserts in order (`stage_index` 1..4); 2 llm_call inserts (decomposition + nutrition); `promptVersionsUsed` populated with both names.
- Without `traceContext`: zero inserts.
- Stage error: stage row with `status: 'error'`, downstream stages NOT logged.
- Mock the db boundary; mock `gemini.generateStructuredOutputStream` to deterministic chunks.

- [ ] **Step 5: Run; iterate**

`bun run test lib/ai/pipeline/__tests__/orchestrator-trace.test.ts`

- [ ] **Step 6: Run all existing pipeline tests** to confirm we didn't break the no-trace path.

`bun run test lib/ai/pipeline/`

- [ ] **Step 7: Commit**

```bash
git add lib/ai/pipeline/orchestrator.ts lib/ai/pipeline/__tests__/orchestrator-trace.test.ts
git commit -m "feat(pipeline): plumb optional traceContext through analyzeMeal

Wraps each of the four stages in withStageLog; decomposition and
nutrition additionally pass a trace into the Gemini client.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 4.3: Wire route.ts to construct traceContext + persist `promptVersionsUsed`

**Files:**
- Modify: `app/api/analyze-meal/route.ts`
- Modify: `lib/ai/pipeline/logging.ts` (extend `logPipelineEnd` with optional `promptVersionsUsed`; today the function uses `db.update(...).catch(...)` fire-and-forget — verify before changing).

- [ ] **Step 1: Extend `logPipelineEnd` signature**

Add an optional last param `promptVersionsUsed?: Record<string, string> | null`. When non-null **and** the map is non-empty, include `promptVersionsUsed` in the SET clause; otherwise leave the column null. (Spec §5.4: "null for failed early stages.")

Per spec, `pipeline_requests.prompt_versions_used` is `null` when no LLM stage completed. The route must therefore convert `Map -> Record | null`:

```ts
const pvu = promptVersionsUsed.size > 0 ? Object.fromEntries(promptVersionsUsed) : null;
```

- [ ] **Step 2: Update `route.ts`**

```ts
const promptVersionsUsed = new Map<string, string>();
const traceContext = { requestId, db, promptVersionsUsed };
try {
  const result = await analyzeMeal(rawInput, userContext, db, gemini, onEvent, traceContext);
  const pvu = promptVersionsUsed.size > 0 ? Object.fromEntries(promptVersionsUsed) : null;
  logPipelineEnd(requestId, 'success', Date.now() - t0, db, undefined, pvu);
  // existing pendingAnalyses + return logic unchanged
} catch (e) {
  const pvu = promptVersionsUsed.size > 0 ? Object.fromEntries(promptVersionsUsed) : null;
  logPipelineEnd(requestId, 'error', Date.now() - t0, db, msg, pvu);
  throw e;
}
```

(`logPipelineEnd` remains fire-and-forget here; awaiting it is a no-op since it returns void today. The replay path in chunk 6 needs different handling — see task 6.1 step 3.)

- [ ] **Step 3: Run all tests**

`bun run test`. Fix any breakage in route-level tests (likely just the new optional arg signature).

- [ ] **Step 4: Commit**

```bash
git add app/api/analyze-meal/route.ts lib/ai/pipeline/logging.ts
git commit -m "feat(api): pass traceContext into analyzeMeal and persist prompt_versions_used

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Chunk 5: Admin pages (read-only)

**Goal:** Requests list + detail (incl. compare mode), prompts list + detail + diff, health overview.

### Task 5.1: Drizzle query helpers

**Files:**
- Create: `lib/admin/queries.ts`
- Create: `lib/admin/__tests__/queries.test.ts`

**Test strategy decision (locked):** Mock the `db` argument with a Drizzle-shaped stub. We do NOT use the real-DB harness (`bun --env-file=.env.local vitest run lib/db/__tests__/`) for these query helpers; that harness exists for the Vietnamese-search pipeline tests and would require seeding admin trace data we don't have. Mocks are sufficient because we're testing query *shape* (filter Zod parsing, included tables, correct WHERE clauses), not Postgres behavior.

- [ ] **Step 1: Write failing tests FIRST**

Create `lib/admin/__tests__/queries.test.ts` with:
- Zod schema parses URLSearchParams shapes correctly (status filter, date range, includeReplays default false).
- `listRequests` excludes replays by default; includes when `includeReplays: true`.
- `healthAggregates` excludes replays unconditionally.

Run: `bun run test lib/admin/__tests__/queries.test.ts` — expect FAIL.

- [ ] **Step 2: Define functions in `lib/admin/queries.ts`**

- `listRequests(db, { filter, page, pageSize })` returning `{ rows, total }`.
- `getRequestDetail(db, id)` returning `{ request, stageLogs[], llmCalls[] }`.
- `listPrompts(db)` returning `[{ name, versionCount, latestSeenAt }]`.
- `getPromptVersions(db, name)` returning `[{ id, codeHash, model, firstSeenAt, gitSha, templateSample }]`.
- `getRequestsForVersion(db, versionId, page, pageSize)`.
- `healthAggregates(db)` returning `{ successRate24h, successRate7d, successRate30d, p50_24h, p95_24h, p99_24h, ... , requestsPerDay30d, topErrors30d }`.

All queries exclude rows where `replay_of_request_id IS NOT NULL` from health aggregates; the requests list excludes them by default but supports an `includeReplays` flag. Define `requestFiltersSchema` (Zod) parsing `URLSearchParams` shape into the filter object.

- [ ] **Step 3: Run tests; expect PASS**

`bun run test lib/admin/__tests__/queries.test.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/admin/queries.ts lib/admin/__tests__/queries.test.ts
git commit -m "feat(admin): query helpers for requests / prompts / health

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 5.2: Requests list page

**Files:**
- Create: `app/admin/requests/page.tsx`
- Create: `app/admin/requests/_components/filters-form.tsx` (`'use client'`)
- Create: `app/admin/requests/_components/requests-table.tsx` (server)

- [ ] **Step 1: Server page**

Reads `searchParams`, parses with Zod, calls `requireAdmin()`, calls `listRequests()`, renders the table + filters.

- [ ] **Step 2: Filters form**

Client component that maintains form state and calls `router.push('/admin/requests?...')` on submit. Use shadcn `Input`, `Select`, `Button`, `Calendar`. Add via `bunx shadcn@latest add input select button calendar` if not already present.

- [ ] **Step 3: Table**

Plain `<table>` with shadcn classes. Each row links to `/admin/requests/<id>`.

- [ ] **Step 4: Commit**

```bash
git add app/admin/requests/
git commit -m "feat(admin): requests list page with filters

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 5.3: Request detail page (incl. compare)

**Files:**
- Create: `app/admin/requests/[id]/page.tsx`
- Create: `app/admin/requests/[id]/_components/stage-timeline.tsx`
- Create: `app/admin/requests/[id]/_components/json-viewer.tsx` (`'use client'`)
- Create: `app/admin/requests/[id]/_components/replay-button.tsx` (`'use client'`)

- [ ] **Step 1: Server page**

`requireAdmin()`. If `searchParams.compare` is set, fetch both detail records and render them in two columns aligned by `stage_index`. Otherwise render single timeline.

- [ ] **Step 2: Stage timeline**

For each stage card: status badge, duration, expandable input/output JSON viewer, nested LLM call rows (rendered prompt, response, tokens, latency, attempt).

- [ ] **Step 3: Compute compare diff badges**

In the server component, shallow-compare `output_json` between the two stages of the same `stage_index` and add a label (`unchanged` / `changed` / `only-here`).

- [ ] **Step 4: Replay button — wired in chunk 6.** For now, render a disabled button with TODO comment.

- [ ] **Step 5: Commit**

```bash
git add app/admin/requests/[id]/
git commit -m "feat(admin): request detail page with stage timeline and compare mode

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 5.4: Prompts pages + diff

**Files:**
- `app/admin/prompts/page.tsx`
- `app/admin/prompts/[name]/page.tsx`
- `app/admin/prompts/[name]/[versionId]/page.tsx`
- `app/admin/prompts/_components/prompt-diff.tsx` (`'use client'`)

- [ ] **Step 1: Add `diff` dep**

`bun add diff && bun add -D @types/diff`

- [ ] **Step 2: Implement pages**

- List page: name + version count + latest_seen.
- Name page: version table + checkbox to pick exactly two → "Compare" button → query string `?a=<idA>&b=<idB>`. Renders unified diff of `template_sample`.
- Version page: metadata + paginated requests-that-used-this-version table.

- [ ] **Step 3: Commit**

```bash
git add app/admin/prompts/ package.json bun.lock
git commit -m "feat(admin): prompts list, version detail, and template diff

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 5.5: Health page

**Files:**
- Create: `app/admin/health/page.tsx`
- Create: `app/admin/health/_components/sparkline.tsx` (server, inline SVG)

- [ ] **Step 1: Server page**

`requireAdmin()`, call `healthAggregates()`, render cards (success rate, P50/P95/P99, requests/day sparkline, top errors).

- [ ] **Step 2: Commit**

```bash
git add app/admin/health/
git commit -m "feat(admin): health overview page

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Chunk 6: Replay action

**Goal:** Replay a request through the current pipeline as a dry-run that does NOT touch `pendingAnalyses`.

### Task 6.1: `replayRequest` server action

**Files:**
- Create: `app/admin/requests/[id]/actions.ts`
- Create: `app/admin/requests/__tests__/replay.test.ts`
- Modify: `lib/ai/pipeline/logging.ts` — refactor `logPipelineStart` to accept a caller-supplied `requestId` and an optional `replayOfRequestId`, and add an awaitable `setPipelineFinalState` helper for the replay path.
- Modify: `app/admin/requests/[id]/_components/replay-button.tsx` to wire the action.

Issues to address (called out from plan review):
- The actual factory is `createGeminiClient(apiKey, retryOptions?)`, NOT `getGeminiClient`. Pass the API key from env, matching the existing call site in `app/api/analyze-meal/route.ts`.
- The actual `logPipelineStart` signature is positional: `logPipelineStart(userId, rawInput, userContext, db): string` and auto-generates `requestId` — we MUST refactor it (or add a parallel helper) to accept a pre-generated `requestId` and `replayOfRequestId`.
- `pipeline_requests.user_id` is `NOT NULL` with FK to `auth.users` — replay must reuse the **original row's user_id**, NOT the admin's id (that would conflate the original user's traffic with admin actions).
- `logPipelineEnd` is fire-and-forget today; `await`-ing returns void immediately. Replay redirects to the detail page, so we MUST await the final-state write before redirecting, otherwise the page can render with `status: 'pending'`. Add a parallel `setPipelineFinalState` that returns the actual update promise.
- `replayRequest`'s `originalId` argument crosses the server-action trust boundary; validate with `z.string().uuid()` per AGENTS.md.

- [ ] **Step 1: Refactor `lib/ai/pipeline/logging.ts`**

Change `logPipelineStart` to:

```ts
export interface LogPipelineStartArgs {
  userId: string;
  rawInput: string;
  userContext: UserContext;
  db: AppDb;
  /** When set, caller controls the requestId (used by replay). */
  requestId?: string;
  /** Marks the row as a dry-run replay of the given original request. */
  replayOfRequestId?: string;
}

export function logPipelineStart(args: LogPipelineStartArgs): string {
  const id = args.requestId ?? crypto.randomUUID();
  // existing fire-and-forget INSERT, but include replay_of_request_id when set
  return id;
}
```

Update the existing call site in `app/api/analyze-meal/route.ts` to use the new options-bag form.

Add an awaitable helper for the replay finalization:

```ts
export async function setPipelineFinalState(args: {
  db: AppDb;
  requestId: string;
  status: 'success' | 'error';
  durationMs: number;
  errorMessage?: string;
  promptVersionsUsed?: Record<string, string> | null;
}): Promise<void> {
  await args.db
    .update(pipelineRequests)
    .set({
      status: args.status,
      durationMs: args.durationMs,
      errorMessage: args.errorMessage ?? null,
      promptVersionsUsed: args.promptVersionsUsed ?? null,
    })
    .where(eq(pipelineRequests.id, args.requestId));
}
```

(`logPipelineEnd` keeps its existing fire-and-forget behavior; production route keeps using it. Replay uses the awaitable variant.)

- [ ] **Step 2: Write failing replay test**

```ts
import { describe, it, vi, expect, beforeEach } from 'vitest';

const insertSpy = vi.fn();
const updateSpy = vi.fn();
const selectSpy = vi.fn();
const pendingInsertSpy = vi.fn();

vi.mock('@/lib/infra/db/client', () => ({
  db: {
    insert: (t: unknown) => {
      if ((t as { __spy?: unknown }).__spy === pendingInsertSpy) {
        return { values: pendingInsertSpy };
      }
      return { values: insertSpy };
    },
    select: () => ({ from: () => ({ where: () => ({ limit: selectSpy }) }) }),
    update: () => ({ set: () => ({ where: updateSpy }) }),
  },
}));
vi.mock('@/lib/infra/db/schema', async () => {
  const actual = await vi.importActual<typeof import('@/lib/infra/db/schema')>(
    '@/lib/infra/db/schema',
  );
  return { ...actual, pendingAnalyses: { __spy: pendingInsertSpy } };
});
const analyzeMealSpy = vi.fn(async () => ({}));
vi.mock('@/lib/ai/pipeline/orchestrator', () => ({ analyzeMeal: analyzeMealSpy }));
vi.mock('@/lib/ai/gemini', () => ({ createGeminiClient: () => ({}) }));
vi.mock('@/lib/admin/require-admin', () => ({
  requireAdmin: async () => ({ id: 'admin-1', email: 'a@x.com' }),
}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

import { replayRequest } from '../[id]/actions';

describe('replayRequest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not write to pendingAnalyses', async () => {
    selectSpy.mockResolvedValue([
      { rawInput: 'x', userContextJson: {}, userId: 'orig-user' },
    ]);
    await replayRequest('11111111-1111-1111-1111-111111111111');
    expect(pendingInsertSpy).not.toHaveBeenCalled();
    expect(analyzeMealSpy).toHaveBeenCalled();
  });

  it('rejects non-uuid input', async () => {
    await expect(replayRequest('not-a-uuid')).rejects.toThrow();
  });

  it('reuses original user_id, not admin id', async () => {
    selectSpy.mockResolvedValue([
      { rawInput: 'x', userContextJson: {}, userId: 'orig-user' },
    ]);
    await replayRequest('11111111-1111-1111-1111-111111111111');
    // assert insertSpy received userId: 'orig-user'
    const insertArgs = insertSpy.mock.calls[0]?.[0];
    expect(insertArgs?.userId).toBe('orig-user');
  });
});
```

- [ ] **Step 3: Implement `actions.ts`**

```ts
'use server';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/infra/db/client';
import { pipelineRequests } from '@/lib/infra/db/schema';
import { analyzeMeal } from '@/lib/ai/pipeline/orchestrator';
import { logPipelineStart, setPipelineFinalState } from '@/lib/ai/pipeline/logging';
import { createGeminiClient } from '@/lib/ai/gemini';
import { requireAdmin } from '@/lib/admin/require-admin';

const idSchema = z.string().uuid();

export async function replayRequest(originalIdInput: string) {
  const originalId = idSchema.parse(originalIdInput);
  const admin = await requireAdmin();

  const [orig] = await db
    .select({
      rawInput: pipelineRequests.rawInput,
      userContextJson: pipelineRequests.userContextJson,
      userId: pipelineRequests.userId,
    })
    .from(pipelineRequests)
    .where(eq(pipelineRequests.id, originalId))
    .limit(1);
  if (!orig) throw new Error('original request not found');

  const replayId = crypto.randomUUID();
  const t0 = Date.now();
  logPipelineStart({
    userId: orig.userId,                  // reuse original user, not admin
    rawInput: orig.rawInput,
    userContext: orig.userContextJson,
    db,
    requestId: replayId,
    replayOfRequestId: originalId,
  });
  console.info(`[admin] ${admin.email} replayed ${originalId} as ${replayId}`);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');
  const gemini = createGeminiClient(apiKey);

  const promptVersionsUsed = new Map<string, string>();
  let finalStatus: 'success' | 'error' = 'success';
  let errorMessage: string | undefined;
  try {
    await analyzeMeal(
      orig.rawInput,
      orig.userContextJson,
      db,
      gemini,
      () => {},
      { requestId: replayId, db, promptVersionsUsed },
    );
  } catch (e) {
    finalStatus = 'error';
    errorMessage = e instanceof Error ? e.message : String(e);
  }

  // AWAITED so the redirect lands on a row in its terminal state,
  // not 'pending'. Production route stays fire-and-forget via logPipelineEnd.
  await setPipelineFinalState({
    db,
    requestId: replayId,
    status: finalStatus,
    durationMs: Date.now() - t0,
    errorMessage,
    promptVersionsUsed:
      promptVersionsUsed.size > 0 ? Object.fromEntries(promptVersionsUsed) : null,
  });

  redirect(`/admin/requests/${replayId}?compare=${originalId}`);
}
```

- [ ] **Step 4: Wire `replay-button.tsx`**

A small client component:

```tsx
'use client';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { replayRequest } from '../actions';

export function ReplayButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            await replayRequest(id);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Replay failed');
          }
        })
      }
    >
      {pending ? 'Replaying…' : 'Replay (dry-run)'}
    </Button>
  );
}
```

- [ ] **Step 5: Run; iterate to green**

`bun run test app/admin/requests/__tests__/replay.test.ts`

- [ ] **Step 6: Commit**

```bash
git add app/admin/requests/[id]/actions.ts \
  app/admin/requests/[id]/_components/replay-button.tsx \
  app/admin/requests/__tests__/ \
  lib/ai/pipeline/logging.ts \
  app/api/analyze-meal/route.ts
git commit -m "feat(admin): replayRequest server action and replay button

Bypasses /api/analyze-meal so pendingAnalyses is never written.
Refactors logPipelineStart to options-bag form and adds awaitable
setPipelineFinalState for the replay path.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Chunk 7: Final lint, typecheck, test pass + rollout notes

### Task 7.1: Full quality pass

- [ ] **Step 1: Lint everything**

`bunx @biomejs/biome@2.4.2 check --write .`

- [ ] **Step 2: Typecheck**

`bunx tsc --noEmit`

- [ ] **Step 3: Tests**

`bun run test`

- [ ] **Step 4: Commit any auto-fixes**

```bash
git add -A
git commit -m "chore: lint pass" || true
```

### Task 7.2: Rollout instructions for the user

Add a short paragraph to the PR description (not a file in the repo):

1. User runs `bun dbr:push` against staging.
2. Merge the code with `PIPELINE_TRACE_ENABLED=false` first.
3. Verify migration applied via `bun dbr:status`.
4. Set `PIPELINE_TRACE_ENABLED=true` and `ADMIN_EMAILS=<your-email>` in Vercel env.
5. Hit `/admin` while signed in as the admin user → expect dashboard.
6. Hit `/admin` signed out or as a non-admin → expect 404.
7. Run a meal analysis → confirm one row appears in `pipeline_stage_logs` and `pipeline_llm_calls` per the spec, and `pipeline_requests.prompt_versions_used` is populated.

### Task 7.3: Open the PR

- [ ] **Step 1: Push**

`git push -u origin feat/admin-pipeline-dashboard`

- [ ] **Step 2: Open PR**

`gh pr create --fill --base main --draft` (draft until user reviews staging).

---

## Risk register

| Risk | Mitigation |
|------|-----------|
| Drizzle migration order conflicts with hand-written migrations | Rename meaningfully; user inspects SQL before `dbr:push`. |
| Stream usageMetadata not arriving on abort | `inputTokens`/`outputTokens` allowed to be null per schema; `error` column captures the reason. |
| Pipeline regression from refactor | Existing tests must pass at every step; traceContext is optional, no-op when absent. |
| FK violations from out-of-order inserts | `pipeline_llm_calls.stage_log_id` is NOT a FK by design (spec §5.3). |
| Token counts on retry double-counted | Each attempt logs its own row with `attempt` index; aggregations sum or take latest as needed. |
| Admin route accidentally indexed | Layout is `dynamic = 'force-dynamic'`; no SEO surface. |
| User pipeline latency regresses with tracing on | All inserts fire-and-forget; `PIPELINE_TRACE_ENABLED=false` is the kill switch. |
