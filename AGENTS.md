# AGENTS.md — Operating Manual for AI Assistants

This file is the **single source of truth** for agent behavior in this repo. Rules here take absolute precedence — never invent ad-hoc behavior or override them. **Flutter app**: `apps/mobile-flutter/AGENTS.md` governs everything under that directory (web rules below do not apply there).

## 1. Hard Prohibitions (NEVER DO)

- **Long-running commands**: never run `bun dev` / `bun run build` / `bun start` unless the user explicitly asks. Exception: `bun dev` while actively testing via Chrome DevTools MCP.
- **Remote DB pushes**: never run `bun dbr:push`, `bun dbr:reset`, or `bun dbr:reset:nobackfill`. Prepare migrations; the user applies them.
- **Secrets**: never commit API keys/tokens/credentials; reference env vars by name only.
- **`package.json` dependencies**: never hand-edit; use `bun add <package>`. (Editing `scripts` is fine.)
- **`components/ui`**: never hand-edit; `bunx shadcn@latest add <component>`.
- **Data fetching via `useEffect`**: never; TanStack Query on the client, Server Actions on the server.
- **Native dialogs**: never `alert()`/`confirm()`/`prompt()`; use `sonner` toasts and shadcn `AlertDialog`.
- **Icons**: `lucide-react` only — no emoji, no other icon sets.

## 2. Mandatory Actions (ALWAYS DO)

- **Pre-coding skill check** — BEFORE any coding task, invoke the matching skill(s) and review their rules:

  | Skill | When to use |
  |-------|-------------|
  | `feature-workflow` | **Invoke FIRST for any non-trivial fix, feature, or refactor.** The umbrella dev loop (orient/probe → decision gate → implement with per-phase verification → `verify-before-done` → `grill-your-own-work` → ship). Validation records: `.claude/skills/_evidence/` (incl. the failed `absorb-steering` skill in `failed-skills/`). |
  | `vercel-react-best-practices` | **Default for all React/Next.js code**: components, pages, data fetching, hooks, server actions, bundle/perf. |
  | `vercel-composition-patterns` | Component architecture: prop-heavy refactors, compound components, context, React 19 patterns. |
  | `kallo-design` | **Required for ANY design/UI work, however small**: brand palette, Lora + DM Sans, icon allowlist, drift watchlist. |
  | `web-design-guidelines` | UI/UX audits: layout, accessibility, responsive, forms, contrast, typography. |
  | `vercel-react-view-transitions` | Page/route/shared-element/enter-exit animations via the View Transition API. |
  | `thermo-nuclear-code-quality-review` | **Pre-PR structural/maintainability review**, and whenever a change grows a file near the 400/200 LOC limits or adds files to a crowded folder. |

- **Gates before signing off**: `bunx @biomejs/biome check .` (auto-fix with `--write`), `bun check:structure`, tests for new features/fixes (Vitest).
- **Zod validation** for all external inputs (API params, form data, URL params); React Hook Form + `@hookform/resolvers` for forms.
- **Pre-read docs**: `docs/DATABASE.md` before DB/migration work; `docs/DATA.md` before food-data work; `docs/EMAIL.md` before touching anything that sends email (auth emails run through our own Supabase hook, not Supabase's mailer); `docs/superpowers/specs/2026-05-08-pipeline-latency-budget.md` before touching `analyzeMeal`, the matching cascade, or the Gemini wrapper.
- **Context7 MCP** for up-to-date library docs — required research before locking designs around third-party behavior (state ownership, routing, persistence).
- **Conventional Commits** (`feat:`, `fix:`, `chore:`, …) drive [release-please](https://github.com/googleapis/release-please) version bumps: `feat!:`/`BREAKING CHANGE` = major (rare — when unsure, downgrade), `feat:` = minor, everything else = patch. Override with a `Release-As: x.y.z` footer or by editing the Release PR. Never hand-edit `CHANGELOG.md` or the version.
- **Branches**: `<type>/<short-kebab-slug>` (≤40 chars), e.g. `feat/jwt-user-auth`. When `EnterWorktree` creates a branch, pass an explicit conforming `name`.
- **Keep docs current**: change a workflow/command/architecture → update the doc that describes it in the same change (web docs in `docs/`, mobile in `apps/docs/mobile/`). Verify every path/command before writing it.
- **Session retrospective**: at session end, propose durable AGENTS.md updates for mistakes/edge cases encountered; verify paths/commands exist; remove redundancy.

## 3. Commands

- Dev: `bun dev` · Build: `bun run build` · Start: `bun start`
- Quality: `bunx @biomejs/biome check .` (`--write` to fix) · `bun check:structure` (size + folder + test-placement + barrel gate, all blocking) · `bun test` / `bun test:watch`
- DB: `bun db:generate` (Drizzle migration from schema) · `bun db:migrate` (apply locally) · `bun db:studio` · `bun dbr:status` · `bun dbr:push` / `bun dbr:reset` (**user only**)
- DB search tests (remote DB): `bun --env-file=.env.local vitest run lib/db/__tests__/`
- **Task board** ("ttr"): team planning board is **Tuturuuu** via the `ttr` CLI (installed + logged in; workspace **Kallo**). Log roadmap items to the Planning board → Backlog. Full doc: `docs/TASK_BOARD.md`.

## 4. Architecture

```
/app                    — Next.js App Router: [locale] pages, /auth, /api routes
/components/<feature>   — feature UI (admin, auth, dashboard, groups, landing-page,
                          logging/{feed,input,sidebar}, nutrition, onboarding,
                          providers, settings, shared, …)
/components/ui          — shadcn/ui (CLI-managed, do not edit)
/lib/<feature>          — domain/data logic (ai, actions/<feature>, db, nutrition,
                          groups, logging, supabase, rate-limit, security, types, …)
/hooks/<feature>        — custom React hooks
/i18n, /messages        — next-intl locales
/scripts                — one-off + CI scripts (gate: ci/check-structure/)
/supabase/migrations    — all SQL migrations (Drizzle-generated + manual)
/docs                   — project docs (ARCHITECTURE, DATABASE, DATA, specs)
/apps/mobile-flutter    — Flutter app (own AGENTS.md; docs in /apps/docs/mobile)
```

Key files: `lib/infra/db/schema.ts` (schema source of truth) · `lib/infra/db/client.ts` (client + `encodeDbUrl()`) · `middleware.ts` (auth/session + origin lock) · `drizzle.config.ts` · `biome.json` (disabled rules documented there).

**AI meal pipeline** (v2 grounded is the default; entry `lib/ai/pipeline/analyze-meal.ts`, which dispatches to `lib/ai/pipeline/grounded/orchestrator.ts` or the flagged `lib/ai/pipeline/legacy/` fallback): Call 1 decomposes the meal text into items + ingredients (no grams) → retrieval + exact-match against FAO/USDA food data (`lib/ai/matching/`) → server-side portion resolver produces gram anchors (`lib/ai/portion/`) → Call 2 grounded estimation runs a per-ingredient CRAG verdict and emits bounded macros, behind the provider-agnostic `GroundedEstimator` seam (`lib/ai/pipeline/estimator/`, Gemini adapter default). Large meals chunk Call 2 with a wall-clock deadline + degrade-to-unresolved contract; fully-grounded simple meals skip Call 2 (server-synthesized, numerically identical — `grounded/fast-path.ts`; the seam is currently unwired, tracked separately, so do not delete it). Deploys on **Google Cloud Run** (not Vercel; `docs/GOOGLE_CLOUD_RUN.md`, `.github/workflows/cloud-run-*.yml`), route `app/api/analyze-meal` has `maxDuration=60`.

**Import aliases** (always use, never deep-relative): `@/*` root, `@/components`, `@/lib`, `@/hooks`, `@/ui`.

## 5. Key Conventions

### File & Folder Organization (enforced)

**The folder is the module.** A folder owns exactly one concern and exposes one public entry file named after that concern. Everything else in it is folder-private — nothing outside imports it. This is what keeps files small *without* scattering a single idea across a fog of shallow files: callers learn one small interface per folder, while internals stay short enough to read in one sitting. `lib/ai/pipeline/estimator/` and `components/nutrition/` are the reference shapes.

- **Size limits**: **400 LOC per source file is a hard ceiling; 100–200 LOC is the target range.** 200 LOC for component/widget files. Enforced by `bun check:structure` with a ratchet baseline (`file-size-baseline.json`: frozen legacy entries may shrink, never grow; no new violations). Data-not-logic exemptions live in `scripts/ci/check-structure/config.mjs` with justifications.
- **≤10 direct source files per folder.** Subfolders are not counted: a folder holding nothing but well-named subfolders is a directory index and reads as one line per concern, so capping it would only force junk-drawer grouping. Past ten files the folder has more than one concern — **name the missing sub-concern and split**. Treat the count as a concern-count signal, not a size signal. Subfolder sprawl is reported separately by `bun check:structure` as an advisory NOTE.
- **Feature-first nesting**: UI in `components/<feature>/`, logic in `lib/<feature>/`, hooks in `hooks/<feature>/`, actions in `lib/actions/<feature>/`. No dumping new files at folder top level.
- **A name is either a file or a folder, never both.** `lib/foo.ts` beside `lib/foo/` makes `@/lib/foo` resolve to the file silently.
- **Tests live in `__tests__/` beside their subject**, one module's tests per folder. A `__tests__/` that needs sub-concern folders means the module it tests does too. Test files may exceed the size limits — a thorough test beats a short one — but they must test the module they sit under.
- **One component per file**; presentation vs state (hooks) vs domain/data (lib) vs orchestration (actions/routes) live in separate files and layers. Nothing in `hooks/` exports a non-hook, and `hooks/` never imports from `components/`.
- **Colocate, then promote**: feature-private helpers stay in the feature folder; promote to shared only on a second consumer. `app/**/_components/` only for truly page-specific pieces — a folder with its own schemas, types and derivation logic is a feature module, not a page part.
- **No barrel files** (re-export `index.ts` hubs); import directly via aliases. A real module that happens to be called `index.ts` gets renamed after its concern.
- **Split along seams** (subcomponents to siblings, pure functions to `lib/`, stage-per-file), never mechanical "part2/helpers" splits. If you cannot name the concern, do not make the split. Full rubric: `thermo-nuclear-code-quality-review` skill.
- **Folder-count exemptions** (external tool contracts, not judgement calls): `supabase/migrations/` (see §7) and `components/ui/` (shadcn CLI resolves `@/components/ui/<name>` flat).

The full module map — one line per folder stating its single concern — is `docs/ARCHITECTURE.md`. Keep it current in the same change that moves a folder.

### Components & Data
- Server Components by default; `'use client'` only for state/effects/browser APIs. TypeScript interfaces for props. Composition over configuration.
- Client data: TanStack Query. Server mutations: Server Actions. `app/api/*` routes only for external access. Errors: `sonner` toast (user) + `console.error` (dev).

### Styling & UI
- Tailwind CSS 4 + CSS variables; merge classes with `cn()` from `@/lib/core/ui/cn`; `next-themes` for dark/light — never hard-code colors.
- Biome formatting: 80-char lines, 2-space indent, single quotes (JS/TS) / double (JSX), semicolons, ES5 trailing commas.
- `motion` for entrance/exit + complex animations; CSS transitions for simple hover/focus. Skeletons for page loads, spinners for action loads. Semantic HTML, ARIA labels, focus management. `next/image` with explicit dimensions.

## 6. Non-Obvious Library Choices (do not substitute)

**Motion** (not Framer Motion) · **Drizzle ORM** (not Prisma) · **postgres.js** (not pg) · **Biome** (not Prettier+ESLint) · **sonner** (not react-hot-toast) · **TanStack Query** (not SWR/raw fetch).

## 7. Database (summary — full doc: `docs/DATABASE.md`)

- **Two domains, never mixed**: Drizzle owns tables/columns/FKs/indexes (`lib/infra/db/schema.ts` → `bun db:generate`); RLS/policies/functions/triggers are hand-written SQL in `supabase/migrations/`. Drizzle migrations must be timestamped before manual ones referencing their columns.
- **`supabase/migrations/` stays flat — do not "organize" it into subfolders.** The Supabase CLI resolves migrations as flat `<timestamp>_name.sql` files and compares them against `supabase_migrations.schema_migrations`; `config.toml`'s `[db.migrations] schema_paths` applies to declarative schemas, not to this folder. Our own `scripts/ci/check-append-only-migrations.mjs` and `scripts/ci/check-migration-timestamps.js` also read it non-recursively, so subfolders would silently drop files out of CI. It is an append-only ledger, not a module — the ≤10-files-per-folder rule is waived here (`FOLDER_EXEMPT` in `scripts/ci/check-structure/config.mjs`). Renaming a committed migration fails CI by design; group them in `supabase/migrations/README.md` instead.
- **Migration flow**: edit schema → generate → rename the random migration name to something meaningful (SQL filename + `meta/_journal.json` tag) → review SQL → user pushes. After a failed remote push: `supabase migration repair --status reverted <timestamp> --linked`.
- **Ingredient search**: pg_trgm fuzzy first, pgvector fallback. Vietnamese diacritics are semantically load-bearing (bò=beef, bơ=butter, bổ=nutritious) — never unaccent query AND data; short words need threshold 0.15, not 0.25+; "wrong" trigram matches are expected (the LLM layer judges quality).
- **Supabase quirks**: pgvector/pg_trgm migrations need `SET search_path TO public, extensions;` at top; `bun` scripts need `--env-file=.env.local`; use `encodeDbUrl()` for special-char passwords.

## 8. Gotchas

- **Embeddings**: `gemini-embedding-001` (768 dims) — `text-embedding-004` is deprecated. Batch with ~35s delays per 50 requests on the free tier; honor 429 retry-after headers.
- **OG images** (`app/api/og/macro-card/[shareId]/` renders via Satori — not a browser): every element with 2+ children needs explicit `display: 'flex'`; literal hex colors only (no `var(--kallo-*)`) — they live in `lib/seo/og/palette.ts`, geometry in `card-geometry.ts`, `_fonts/*.ttf` loading in `fonts.ts`. The card itself is `_components/macro-card.tsx`; the route only reads the DB and maps rows to its props.
- **New `/auth/*` routes** must be handled in the `middleware.ts` matcher/origin-lock flow, or next-intl rewrites them to `/{locale}/auth/...` and 404s — tests don't catch this (they call handlers directly).
- Check `package.json` scripts before assuming a command exists; run tests immediately after editing test files (don't batch edits, then debug multiple failures).

## 9. Decision Log (context → decision; all Active)

| Decision | Why / tradeoff |
|----------|----------------|
| Diacritic queries → `search_text`, ASCII → `search_text_ascii` | Diacritics are load-bearing; routing complexity preserves meaning |
| `BoundedNutrition {low,mid,high}` in the pipeline; flat numerics in persisted meal history | Uncertainty preserved during estimation without bloating rows |
| One-shot SSE ReadableStream (no WebSocket); raw fetch for the SSE consumer (no TanStack) | Serverless-compatible; purpose-built state machine beats fighting the abstraction |
| 768-dim `gemini-embedding-001` vectors | Better multilingual quality |
| Locket-style link invites instead of `@handle` search | No discovery surface; forwarded-link risk mitigated by remove-friend |
