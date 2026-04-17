---
name: review-before-pr
description: |
  This project-local skill should be used when the user types `/review-before-pr` or asks for a pre-PR review such as "review this before I open a PR", "run the full reviewer suite", "do a fast pre-PR pass", or "run a security-heavy review". It orchestrates 8 repo-owned reviewer agents from `.github/agents`, supports full, fast, and targeted modes, auto-applies only low-risk fixes, and escalates risky changes for approval.
allowed-tools:
  - Task
  - Read
  - Glob
  - Grep
  - AskUserQuestion
  - Bash
---

# Review Before PR

Run a principal-engineer review pass that can both **auto-fix safe issues** and
**escalate risky changes** before a PR is opened.

## Core Principles

1. **Full mode is the default.** If the user does not specify flags, run all 8
   reviewer agents in parallel.
2. **Fast mode is still opinionated.** It is not "security only". It keeps the
   always-on reviewers and conditionally adds the data and architecture
   reviewers when the diff touches their risk surfaces.
3. **Targeted flags should be honored precisely.** Prefer exact reviewer
   selection plus alias expansion. Only add another reviewer when the requested
   reviewer cannot make a trustworthy call in isolation.
4. **Safe fixes should be applied automatically, but never in parallel.**
   Detect in parallel first. Apply approved safe fixes sequentially afterward,
   grouped by reviewer and file.
5. **Major-risk changes must come back to the user.** Any change that would
   alter architecture, workflow, access rules, product behavior, or other
   material semantics must be escalated with `AskUserQuestion`.

## Reviewer Agents

Use these repo-owned custom agents from `.github/agents/`:

- `review-security-trust`
- `review-data-migration-safety`
- `review-correctness-state-flow`
- `review-architecture-boundaries`
- `review-nextjs-react-patterns`
- `review-performance-scalability`
- `review-maintainability-simplification`
- `review-ux-quality`

## Mode Semantics

## Flag Precedence

Use this precedence order every time:

1. **Targeted reviewer flags win.**
   - If any reviewer flag is present (`--security`, `--data`, `--framework`,
     etc.), run targeted mode.
   - Alias flags expand to the same reviewer (`--state` => correctness,
     `--react` => framework, `--clean-code` => maintainability, etc.).
   - Ignore full/fast reviewer selection when targeted reviewer flags are
     present.
2. **`--fast` applies only when no targeted reviewer flags are present.**
3. **No reviewer flags + no `--fast` = full mode.**
4. **`--security-heavy` is an overlay flag.**
   - If security is selected explicitly, or included by full/fast mode, heavy
     reporting applies to the security reviewer.
   - If security is not selected, `--security-heavy` alone does not force a
     review; pair it with full, fast, or `--security`.

### Default full mode

Run all 8 reviewer agents in parallel.

### Fast mode

When the user passes `--fast`, always run:

- `review-security-trust`
- `review-correctness-state-flow`
- `review-nextjs-react-patterns`
- `review-performance-scalability`
- `review-maintainability-simplification`
- `review-ux-quality`

Conditionally add:

- `review-data-migration-safety` when the diff touches schema, SQL, DB access,
  migration files, Supabase client access, or Drizzle-related code.
- `review-architecture-boundaries` when the diff touches large files,
  orchestrators, module boundaries, moves, or obvious cross-layer files.

### Targeted reviewer flags

Use the user's requested flags plus narrow alias expansion:

| Flag | Reviewer |
|------|----------|
| `--security` | `review-security-trust` |
| `--data` | `review-data-migration-safety` |
| `--correctness` / `--state` | `review-correctness-state-flow` |
| `--architecture` | `review-architecture-boundaries` |
| `--framework` / `--nextjs` / `--react` | `review-nextjs-react-patterns` |
| `--performance` | `review-performance-scalability` |
| `--maintainability` / `--clean-code` / `--simplify` | `review-maintainability-simplification` |
| `--ux` / `--quality` / `--a11y` | `review-ux-quality` |

Optional reporting flag:

- `--security-heavy` switches the security reviewer from the default
  light-reporting mode to heavy mode with explicit OWASP Top 10 / ASVS
  references in findings.

Future-facing flag:

- `--verbose` may widen reporting later, but do not invent verbose behavior now
  unless the user explicitly requests it.

## Diff Scope Contract

Choose review scope deterministically:

1. If the user explicitly says **staged**, review the staged diff only.
2. If the user explicitly says **unstaged** or **working tree**, review the
   unstaged diff only.
3. If there are staged changes and no unstaged changes, review the staged diff.
4. If there are unstaged changes and no staged changes, review the working tree
   diff.
5. If both staged and unstaged changes exist and the user did not narrow scope,
   review both together.
6. If the working tree is clean, review the branch diff against `main`
   (`main...HEAD`).

Always pass the same scope to every reviewer in a single run.

## Orchestration Process

1. **Parse the request**
   - Determine whether the user asked for full mode, `--fast`, or targeted
     flags.
   - Detect whether `--security-heavy` was requested.
   - Resolve reviewer selection using the precedence rules above.

2. **Collect diff context**
   - Gather the diff scope using the contract above.
   - Build a concise changed-file summary to pass to every reviewer.
   - Include enough repo context for reviewers to avoid rediscovering the same
     boundaries independently.

3. **Launch reviewer agents in parallel for detection only**
   - Use the `Task` tool to run the selected reviewer agents in parallel.
   - The first pass is **review-only**. Reviewers should not edit files in this
     phase.
   - Pass each agent a canonical payload:

     ```text
     phase: detect
     mode: full | fast | targeted
     security_reporting: light | heavy
     selected_reviewers: [...]
      diff_scope: [staged | unstaged | combined | branch]
      changed_files: [...]
      diff_summary: [...]
      edit_policy: "Do not edit in detect phase. Identify safe auto-fixes separately."
      evidence_policy: "Use repo evidence first (diff, AGENTS.md, docs, package.json, tests), PR metadata second when available (`gh` / GitHub tools), and official web docs third for version-sensitive guidance. Every non-trivial claim needs concrete evidence."
      output_contract: "Return exactly these sections: Reviewer Summary, Auto-Applied Fixes, Escalations, Important Findings, Reminder Notes."
      ```

4. **Merge detection results**
   - Keep the reviewer taxonomy crisp:
     - Security owns auth, secrets, SSRF, trust boundaries, and OWASP coverage.
     - Data owns schema, migrations, RLS/policies, SQL function safety, query
       scoping, and rollout safety.
     - Correctness owns workflow bugs, races, idempotency, rollback semantics,
       and state-flow hazards.
     - Architecture owns layering, module ownership, boundary leaks,
       orchestration thickness, and structural hotspot drift.
     - Framework owns Next.js / React pattern correctness, client/server
       boundaries, TanStack Query guidance, and framework rule compliance.
     - Performance owns latency, waterfalls, bundle cost, cache opportunities,
       throughput bottlenecks, and AI pipeline cost/latency inefficiencies.
     - Maintainability owns simplification, splits, renames, dead code removal,
       duplication cleanup, and local reorganization.
     - UX owns user-facing resilience, forms, a11y, loading/error states, and
       trust/comprehension quality.
   - When multiple reviewers flag the same issue, keep the finding under the
     reviewer that owns the root cause and suppress duplicates elsewhere.

5. **Apply safe fixes sequentially**
   - Only after the detect phase is merged should you apply safe fixes.
   - Apply edits one reviewer at a time, grouped by file, to avoid edit races.
   - For reviewers that are allowed to edit, pass a second canonical payload:

     ```text
     phase: apply
      approved_auto_fixes: [...]
      changed_files: [...]
      diff_scope: [...]
      edit_policy: "Apply only the approved low-risk fixes within your boundary. Group report items by file."
      evidence_policy: "Keep citing concrete repo evidence for each applied fix. If a fix depends on current vendor behavior, verify against official docs before editing."
      output_contract: "Return exactly these sections: Reviewer Summary, Auto-Applied Fixes, Escalations, Important Findings, Reminder Notes. Keep Important Findings and Reminder Notes brief in apply phase."
      ```

6. **Handle escalations**
   - If no reviewer escalates, present the merged report directly.
   - If any reviewer escalates, summarize the risky changes first, then use
     `AskUserQuestion` to get approval or direction before attempting those
     changes.
   - Group escalations by reviewer and file so the decision burden stays clear.

7. **Run post-edit validation**
   - If any files were edited, run `bunx @biomejs/biome check .`.
   - Run relevant tests when the edits touch executable app behavior and there is
     a clear existing test target.
   - If validation is blocked by a pre-existing repo issue, report that plainly
     instead of pretending validation passed.

## Report Shape

Return a compact merged report in this order:

1. **Review summary** — what was reviewed, which mode ran, and how many
   reviewers participated.
2. **Auto-applied fixes** — grouped by reviewer, then file.
3. **Escalations requiring approval** — grouped by reviewer, then file.
4. **Important findings not auto-fixed** — grouped by reviewer.
5. **Reminder notes** — use this for persistent reminders like rate limiting.

Default to balanced output. Do not turn the report into an exhaustive dump.

## Guardrails

- Do not let the performance reviewer silently change concurrency, caching, or
  other sensitive behavior.
- Do not let the data reviewer silently change schema semantics, policies,
  rollout sequencing, or query meaning.
- Do not let the maintainability reviewer silently change public APIs, shared
  abstractions, or business semantics.
- Do not let the framework reviewer silently switch between Server Actions,
  route handlers, and client fetching when that changes product behavior.
- Do not let the UX reviewer silently redesign interaction flows.
- Do not override the repo's `AGENTS.md`. It is part of the review source of
  truth.
- Do not mutate files from multiple reviewer agents at the same time.

## Examples

### Full review

```text
/review-before-pr
```

Run all 8 reviewers in parallel.

### Fast review

```text
/review-before-pr --fast
```

Run the always-on fast reviewers plus conditional data / architecture reviewers
if the diff touches their surfaces.

### Targeted review

```text
/review-before-pr --security --performance
```

Run only the security and performance reviewers, unless a hard dependency is
required for a trustworthy answer.

### Heavy security reporting

```text
/review-before-pr --security --security-heavy
```

Run the security reviewer with explicit OWASP Top 10 / ASVS references in
findings.
