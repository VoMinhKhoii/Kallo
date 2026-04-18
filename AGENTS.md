# AGENTS.md — Operating Manual for AI Assistants

## 1. Purpose & Precedence

This file is the **single source of truth** for agent behavior. Rules here take absolute precedence. **NEVER** invent ad-hoc behavior or override these instructions.

## 2. Guardrails & Hard Boundaries

### 2.1 Hard Prohibitions (NEVER DO)

- **Long-Running Commands**: NEVER run `bun dev`, `bun run build`, or `bun start` unless the user **explicitly requests** it. Exception: `bun dev` is allowed when actively using Chrome DevTools MCP for testing.
- **Database Production Push**: NEVER run `bun dbr:push`, `bun dbr:reset`, or `bun dbr:reset:nobackfill`. Prepare migrations; the user applies them.
- **Sensitive Data**: NEVER commit secrets, API keys, tokens, or credentials. Reference environment variables by name only.
- **Manual Dependency Edits**: NEVER manually edit `package.json`. Always use `bun add <package>`.
- **shadcn/ui Components**: NEVER manually edit files in `/components/ui`. Use `bunx shadcn@latest add <component>` to add/update.
- **Data Fetching via useEffect**: NEVER use `useEffect` for data fetching. Use TanStack Query (`useQuery`/`useMutation`) for client components, Server Actions for server-side.
- **Native Browser Dialogs**: NEVER use `alert()`, `confirm()`, or `prompt()`. Use `sonner` for toasts and shadcn `AlertDialog` for confirmations.
- **Non-Lucide Icons**: NEVER use emoji or non-Lucide icon libraries in UI code. Use `lucide-react` exclusively.

### 2.2 Mandatory Actions (ALWAYS DO)

- **Pre-Coding Skill Check**: BEFORE ANY coding task — even the slightest edit — invoke the relevant React skill(s) from Vercel and review matching rules. Only begin coding after relevant rules have been reviewed. This prevents anti-patterns before they're written.

  **Which skill to invoke:**

  | Skill | When to use |
  |-------|-------------|
  | `vercel-react-best-practices` | **Default for all tasks.** Any React/Next.js code: components, pages, data fetching, hooks, server actions, bundle optimization, re-render prevention, SSR/client patterns. 68 rules across 8 categories. |
  | `vercel-composition-patterns` | Component architecture: refactoring prop-heavy components, building compound components, designing reusable APIs, lifting state, context providers, React 19 patterns. |
  | `web-design-guidelines` | UI/UX work: styling, layout, accessibility, responsive design, form design, color contrast, spacing, typography. Audits against Web Interface Guidelines. |
  | `vercel-react-view-transitions` | Animations: page transitions, route change animations, shared element animations, enter/exit animations, list reorder, directional navigation. Uses native View Transition API. |

  **Workflow:** Invoke skill → search rules matching your task → read relevant rules → then code.
  **Multiple skills:** If a task spans categories (e.g., new component with animations), invoke all relevant skills.

- **End-of-Session Check**: Run `bunx @biomejs/biome check .` before signing off. Fix issues you introduced.
- **Write Tests**: Write tests (Vitest) for new features and bug fixes.
- **Zod Validation**: Validate all external inputs (API params, form data, URL params) with Zod schemas.
- **Pre-Read Docs**: Read `docs/DATABASE.md` before any DB/migration work. Read `docs/DATA.md` before food data work.
- **Context7 MCP**: Use Context7 MCP tool to fetch up-to-date documentation when working with any technology. Training data may be outdated.
- **Established Pattern Research**: When a task involves a third-party library, framework feature, or product behavior that is already widely solved by other developers, use Context7 early to review the official docs and recommended patterns before locking the design or implementation. Treat this as required research for state ownership, routing, persistence, and other edge-case-heavy behavior so we do not reinvent brittle local patterns.
- **Conventional Commits**: Use conventional commit format: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`.
- **Formatting Workflow**: Run `bunx @biomejs/biome check --write .` before making manual formatting fixes.
- **Proactive Refactoring**: Flag files >400 LOC and components >200 LOC for extraction into smaller units.
- **Session Retrospective**: At the end of every session, review mistakes/edge cases encountered and propose AGENTS.md updates. Verify all file paths and commands exist before adding new rules.

## 3. Commands

### Development
- `bun dev` — Start dev server (localhost:3000)
- `bun run build` — Build for production
- `bun start` — Start production server

### Code Quality
- `bunx @biomejs/biome check .` — Lint check
- `bunx @biomejs/biome check --write .` — Lint + auto-fix
- `bunx @biomejs/biome format --write .` — Format code

### Database
- `bun db:generate` — Generate Drizzle migration from schema changes
- `bun db:migrate` — Apply migrations locally
- `bun db:studio` — Open Drizzle Studio (DB browser)
- `bun dbr:push` — Push migrations to remote (**user only**)
- `bun dbr:reset` — Reset remote DB + seed + backfill (**user only**, interactive `y`)
- `bun dbr:status` — List remote migration status

### Testing
- `bun test` — Run all tests (Vitest)
- `bun test:watch` — Run tests in watch mode
- `bun --env-file=.env.local vitest run lib/db/__tests__/` — DB search tests (requires remote DB)

## 4. Architecture

### Project Structure
```
/app                    — Next.js App Router pages, layouts, API routes
/components/ui          — shadcn/ui components (CLI-managed, do not edit)
/components/landing-page — Custom landing page components
/lib                    — Shared utilities
/lib/db                 — Drizzle ORM schema, client, utilities
/lib/db/__tests__       — DB-level tests (run against remote Supabase)
/lib/supabase           — Supabase client helpers (server, client, middleware)
/lib/types              — Shared TypeScript types
/hooks                  — Custom React hooks
/scripts                — One-off scripts (embedding backfill, data extraction)
/supabase/migrations    — All SQL migrations (Drizzle-generated + manual)
/supabase/seed.sql      — Seed data (526 food composition records)
/docs                   — Project documentation (PRD, DATA, DATABASE, DESIGN)
/public                 — Static assets
```

### Key Files
- `lib/db/schema.ts` — Database schema source of truth (Drizzle ORM)
- `lib/db/index.ts` — DB client + `encodeDbUrl()` helper
- `middleware.ts` — Supabase auth session management
- `app/layout.tsx` — Root layout (fonts, providers, global styles)
- `drizzle.config.ts` — Drizzle ORM configuration
- `docs/DATABASE.md` — Full database architecture documentation
- `docs/DATA.md` — VTN FCT 2007 food data documentation
- `docs/PRD.md` — Product requirements
- `docs/DESIGN.md` — Design specifications
- `biome.json` — Biome linter/formatter config (disabled rules documented here)

### Import Aliases
- `@/*` → Root directory
- `@/components` → `./components`
- `@/lib` → `./lib`
- `@/hooks` → `./hooks`
- `@/ui` → `./components/ui`

Always use aliases instead of relative imports.

## 5. Key Conventions

### Component Patterns
- **React Server Components** by default (App Router)
- `'use client'` only when needed (state, effects, browser APIs)
- **TypeScript interfaces** for props and component contracts
- Prefer composition over configuration

### Data Fetching & Mutations
- **Client components**: TanStack Query (`useQuery`/`useMutation`)
- **Server-side**: Server Actions (`'use server'`)
- **API Routes** (`app/api/...`): Only when external access is needed
- **Error handling**: `sonner` toast for user-facing errors, `console.error` for dev

### Styling & Theming
- Tailwind CSS 4 with CSS variables
- Use `cn()` from `@/lib/utils` to merge classes
- `next-themes` for dark/light mode — never hard-code colors
- Line width: 80 chars, indentation: 2 spaces
- Biome: single quotes (JS/TS), double quotes (JSX), semicolons required, trailing commas (ES5)
- See `biome.json` for disabled rules and full config

### Icons & UI
- `lucide-react` for all icons
- `sonner` for toasts — never native `alert()`/`confirm()`
- shadcn `AlertDialog` for confirmations

### Animations
- `motion` library for entrance/exit and complex animations
- CSS transitions for simple hover/focus states

### Validation
- Zod schemas for all external inputs (API params, form data, URL params)
- React Hook Form + `@hookform/resolvers` for form validation

## 6. Non-Obvious Library Choices

These are intentional choices — do not substitute alternatives:
- **Motion** (not Framer Motion) — animation library
- **Drizzle ORM** (not Prisma) — DB access via `drizzle-orm/postgres-js`
- **postgres** (postgres.js, not pg) — PostgreSQL driver
- **Biome** (not Prettier + ESLint alone) — primary linter/formatter
- **sonner** (not react-hot-toast) — toast notifications
- **TanStack Query** — client-side data fetching (not SWR, not raw fetch)

## 7. Canonical Workflows

### Database Migration
1. Edit `lib/db/schema.ts` (the schema source of truth)
2. Run `bun db:generate` to create migration SQL
3. Review generated SQL in `supabase/migrations/`
4. For RLS/policies/functions/triggers: hand-write a separate migration in `supabase/migrations/`
5. Drizzle migrations MUST be timestamped **before** manual migrations that reference their columns
6. User runs `bun dbr:push` to apply remotely

### Adding New Pages
1. Create route file in `/app` (Server Component by default)
2. Add `'use client'` only if state/interactivity is required
3. Use Server Actions for mutations, TanStack Query for client-side data
4. Validate all inputs with Zod schemas
5. Use `sonner` for error/success toasts
6. Use `next/image` for images, `lucide-react` for icons
7. Write tests for the new page/feature

## 8. Database Architecture

Full documentation in `docs/DATABASE.md`. Key points:

### Two-Domain Model (Do Not Mix)
- **Domain A (Drizzle)**: Tables, columns, types, defaults, FKs, indexes, CHECKs → edit `lib/db/schema.ts` → `bun db:generate`
- **Domain B (Manual SQL)**: RLS, policies, functions, triggers, extensions → hand-write in `supabase/migrations/`

### Ingredient Search Pipeline
1. **Primary**: `fuzzy_match_ingredients()` — pg_trgm trigram matching (free, instant)
2. **Fallback**: `match_ingredients()` — pgvector cosine similarity (needs Gemini API embedding)
3. Vietnamese diacritics are **semantically load-bearing** — auto-routes diacritic queries to `search_text`, ASCII queries to `search_text_ascii`

### Supabase Quirks
- Migrations using pgvector/pg_trgm need `SET search_path TO public, extensions;` at top
- `bun` does NOT auto-load `.env.local` for scripts — always use `--env-file=.env.local`
- `DATABASE_URL` password may have special chars — use `encodeDbUrl()` from `@/lib/db`

## 9. Gotchas & Known Issues

### Schema & Migrations
- **Always edit `lib/db/schema.ts` first** for column changes, then generate. Never hand-add columns in SQL migrations.
- **Always rename Drizzle migrations** to meaningful names after generation. Replace the random name (e.g., `right_maria_hill`) in both the SQL filename and `meta/_journal.json` tag field. Example: `20260401174419_right_maria_hill.sql` → `20260401174419_add_ingredient_sources.sql`.
- **Test migrations against remote DB early**. Local and remote Supabase behave differently (search_path, extensions).
- **After `bun dbr:push` fails mid-migration**: repair with `supabase migration repair --status reverted <timestamp> --linked`.
- **Drizzle snapshot/journal must stay in sync** when reordering timestamps.
- **Always include meaningful names** when converting Drizzle to Supabase migrations.

### Vietnamese Text Search
- **Never unaccent both query AND data** simultaneously. Diacritics are load-bearing: bò=beef, bơ=butter, bổ=nutritious.
- **Short Vietnamese words** (tôm, bún, gạo) have low trigram similarity (0.14–0.24). Use threshold 0.15, not 0.25+.
- **pg_trgm can return "wrong" matches** — this is expected. The LLM layer judges quality; the DB layer retrieves candidates.

### Embeddings & API
- **`text-embedding-004` is deprecated**. Use `gemini-embedding-001` (768 dims).
- **Batch operations need rate limiting**: 35s delays between batches of 50 for 100 req/min free tier.
- **Parse 429 retry-after headers** from Gemini API for accurate backoff.

### Agent Workflow
- **Check `package.json` scripts** before assuming a command exists.
- **For Supabase interactive commands** (`dbr:reset`): use `bash mode="async"` with `write_bash` to send `y`.
- **Run tests immediately after editing test files** — don't batch edits then debug multiple failures.

## 10. Performance & Quality

### Loading States
- Use skeleton components for page/section loading
- Use spinners for action-triggered loading (button clicks, form submissions)
- Always show loading state for async operations

### Accessibility
- Add keyboard navigation support for interactive elements
- Use semantic HTML and ARIA labels where appropriate
- Manage focus for modals, dialogs, and navigation changes

### Image Optimization
- Use `next/image` for all images (automatic optimization, lazy loading)
- Prefer WebP format for static assets
- Set explicit `width`/`height` or use `fill` to prevent layout shift

### React Performance
- Use `React.memo` for expensive pure components that re-render frequently
- Use `useMemo`/`useCallback` for expensive computations and stable references
- Use `next/dynamic` for heavy components not needed on initial render

## 11. Continuous Improvement

At the **end of every session**:
1. Review mistakes, edge cases, or ambiguities encountered
2. Propose updates to this AGENTS.md with durable rules (not chronological logs)
3. **Verify** all file paths exist and commands work before adding new rules
4. Remove redundancy — ensure new knowledge isn't already covered

## 12. Decision Log

Architectural decisions and their rationale. Format: Context → Decision → Tradeoff → Status.

| Context | Decision | Tradeoff | Status |
|---------|----------|----------|--------|
| Vietnamese diacritics are semantically load-bearing | Auto-route: diacritic → search_text, ASCII → search_text_ascii | More complex query routing but preserves meaning | Active |
| LLM nutrition estimates need bounds | BoundedNutrition {low, mid, high} stays in the analysis pipeline; persisted meal history stores flat numeric nutrient values | Preserves uncertainty during estimation without bloating meal history rows | Active |
| SSE over WebSocket for streaming | One-shot ReadableStream SSE, not persistent WebSocket | Simpler serverless compat but no server push | Active |
| TanStack Query not used for SSE | Raw fetch + ReadableStream for SSE consumer | Purpose-built state machine vs fighting TanStack abstraction | Active |
| Animation library | motion (not Framer Motion) for all animations | Lighter bundle, same API surface | Active |
| Vector dimensions | 768-dim via gemini-embedding-001 (text-embedding-004 deprecated) | Larger vectors but better multilingual quality | Active |
