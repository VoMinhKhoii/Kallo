# review-before-pr

Repo-specific review orchestration for this codebase.

## Invocation contract

Use it directly as a project-local skill:

```text
/review-before-pr [flags]
```

Common phrasings that should map to this skill:

- "review this before I open a PR"
- "run the full reviewer suite"
- "do a fast pre-PR pass"
- "run a security-heavy review"

## What it does

`/review-before-pr` runs a principal-engineer review layer across 8 custom
agents:

1. Security & Trust
2. Data & Migration Safety
3. Correctness & State Flow
4. Architecture & Boundaries
5. Next.js / React Patterns
6. Performance & Scalability
7. Maintainability & Simplification
8. UX & Quality

The skill can:

- run the full suite,
- run a fast mode,
- target specific reviewer categories,
- auto-apply low-risk fixes,
- escalate major-risk changes back to the user.

## Modes

### Full mode

```text
/review-before-pr
```

Runs all 8 reviewers in parallel.

### Fast mode

```text
/review-before-pr --fast
```

Always runs:

- security
- correctness
- framework
- performance
- maintainability
- UX

Conditionally adds:

- data when DB / Supabase / Drizzle / migration surfaces change
- architecture when large files, orchestrators, module moves, or cross-layer
  boundaries are involved

## Flag precedence

1. Any targeted reviewer flag switches the run into **targeted mode**.
2. `--fast` only matters when no targeted reviewer flags are present.
3. No targeted flags and no `--fast` means **full mode**.
4. `--security-heavy` is an overlay flag for the security reviewer whenever
   security is selected or included by mode. By itself, `--security-heavy` does
   **not** select the security reviewer.

## Targeted flags

| Flag | Reviewer |
|------|----------|
| `--security` | Security & Trust |
| `--data` | Data & Migration Safety |
| `--correctness`, `--state` | Correctness & State Flow |
| `--architecture` | Architecture & Boundaries |
| `--framework`, `--nextjs`, `--react` | Next.js / React Patterns |
| `--performance` | Performance & Scalability |
| `--maintainability`, `--clean-code`, `--simplify` | Maintainability & Simplification |
| `--ux`, `--quality`, `--a11y` | UX & Quality |

## Security reporting modes

Default security output is **light mode**:

- OWASP is used internally for coverage
- references are only mentioned for major findings

Optional heavy mode:

```text
/review-before-pr --security --security-heavy
```

Heavy mode includes explicit OWASP Top 10 / ASVS references in security
findings.

## Auto-fix philosophy

- **Low-risk** fixes should be applied automatically.
- **Major-risk** changes should be escalated back to the user.
- Auto-applied fixes must be reported **grouped by reviewer and file**.
- Detection happens in parallel, but edits are applied **sequentially** to avoid
  reviewer edit conflicts.

## Diff scope

The skill should choose one review scope for the whole run:

1. explicit staged request => staged diff
2. explicit unstaged/working-tree request => unstaged diff
3. staged only present => staged diff
4. unstaged only present => working-tree diff
5. both staged and unstaged present with no user narrowing => combined scope
6. clean working tree => branch diff against `main...HEAD`

Examples of likely auto-fixes:

- maintainability splits, renames, dead-code removal, local reorganization
- clear framework cleanups when intent is obvious
- obvious UX resilience / a11y fixes
- obvious security hygiene fixes like removing sensitive logging

Examples of likely escalations:

- architecture ownership changes
- RLS / policy logic changes
- workflow or state-machine semantics changes
- major data-flow switches between Server Actions, routes, and client fetching
- telemetry strategy changes

## Repo-owned agents

The skill depends on these agent files:

- `.github/agents/review-security-trust.md`
- `.github/agents/review-data-migration-safety.md`
- `.github/agents/review-correctness-state-flow.md`
- `.github/agents/review-architecture-boundaries.md`
- `.github/agents/review-nextjs-react-patterns.md`
- `.github/agents/review-performance-scalability.md`
- `.github/agents/review-maintainability-simplification.md`
- `.github/agents/review-ux-quality.md`

## Validation expectations

After any auto-applied fixes:

- run `bunx @biomejs/biome check .`
- run relevant existing tests when the edited files affect executable behavior
- report clearly if validation is blocked by a pre-existing repo issue
