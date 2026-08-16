---
name: thermo-nuclear-code-quality-review
description: |
  Run an extremely strict maintainability review for abstraction quality, oversized
  files, flat-folder sprawl, and spaghetti-condition growth — tuned to this repo.
  Use for a thermo-nuclear code quality review, thermonuclear review, deep code
  quality audit, or especially harsh maintainability review; also consult whenever
  a change grows any file near the repo's 400/200 LOC limits or adds files to an
  already crowded folder. This project-local version shadows the global gstack
  skill of the same name: it replaces the generic 1000-line rule with the repo's
  strict 400/200 thresholds (mechanically enforced by `bun check:structure`) and
  adds binding File & Folder Organization standards (feature-first nesting,
  separation of concerns, folder size limits, no barrels).
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Agent
metadata:
  author: local-fork-of-gstack-thermo-nuclear
  version: "1.0.0"
---

# Thermo-Nuclear Code Quality Review (Nhẩm/Kallo local)

Use this skill for an unusually strict review focused on implementation quality,
maintainability, abstraction quality, and codebase health.

Above all, this skill should push the reviewer to be **ambitious** about code
structure. Do not merely identify local cleanup opportunities. Actively search for
"code judo" moves: restructurings that preserve behavior while making the
implementation dramatically simpler, smaller, more direct, and more elegant.

**Division of labor:** `grill-your-own-work` is the correctness/parity adversarial
closer; THIS skill is the structure/maintainability review. Run both before a PR;
don't duplicate each other's findings. If you fan out review subagents here, every
prompt includes **"REPORT ONLY. DO NOT EDIT ANY FILES."** — same rule, same reason
(edit-capable reviewers have regressed clean gates in this repo's recorded history).

## Core Prompt

Start from this baseline:

> Perform a deep code quality audit of the current branch's changes.
> Rethink how to structure / implement the changes to meaningfully improve code quality without impacting behavior.
> Work to improve abstractions, modularity, reduce Spaghetti code, improve succinctness and legibility.
> Be ambitious, if there is a clear path to improving the implementation that involves restructuring some of the codebase, go for it.
> Be extremely thorough and rigorous. Measure twice, cut once.

## Repo Ground Rules (before writing any finding)

- **Attribute to the diff, not the base.** Before blaming the PR for anything:
  `git show origin/main:<file> | grep -n <suspect>`. Pre-existing structural debt
  goes to the ratchet backlog (`file-size-baseline.json`), not the PR verdict —
  report it separately.
- **Gates around any suggested restructuring.** Web: `bunx tsc --noEmit`,
  `biome ci .`, `bun vitest run`. Flutter (`apps/mobile-flutter`): `flutter analyze`,
  `flutter test`. A restructuring proposal that hasn't been checked against these is
  a sketch, not a recommendation.
- **The mechanical size gate already runs in CI** (`bun check:structure`): 400 LOC
  per source file, 200 LOC per component/widget file, ratchet baseline for legacy,
  explicit exemption list for data-not-logic files. Your job as reviewer is what the
  script can't see: near-threshold growth, poor split choices, mechanical
  "part1/part2" splits done only to appease the gate, and structure that is bad at
  any size.

## Non-Negotiable Additional Standards

Apply the baseline prompt above, plus these explicit review rules:

0. **Be ambitious about structural simplification.**
   - Do not stop at "this could be a bit cleaner."
   - Look for opportunities to reframe the change so that whole branches, helpers, modes, conditionals, or layers disappear entirely.
   - Prefer the solution that makes the code feel inevitable in hindsight.
   - Assume there is often a "code judo" move available: a re-organization that uses the existing architecture more effectively and makes the change dramatically simpler and more elegant.
   - If you see a path to delete complexity rather than rearrange it, push hard for that path.

1. **Strict size limits: 400 LOC per source file, 200 LOC per component file.**
   - Source files: any `.ts`/`.tsx` in the web app, any `.dart` in
     `apps/mobile-flutter/lib/` — crossing **400 LOC** is a presumptive blocker.
   - Component files: `components/**/*.tsx` (excluding CLI-managed
     `components/ui/`), `app/**/_components/**/*.tsx`, Flutter
     `lib/**/widgets/**/*.dart` and `lib/shell/*.dart` — crossing **200 LOC** is a
     presumptive blocker.
   - Exempt-listed files (see `SIZE_EXEMPT` in `scripts/ci/check-structure/config.mjs`: Drizzle
     schema, pure data catalogs, prompt text) are out of scope for size complaints
     but fully in scope for structure and legibility review.
   - A PR that merely *approaches* a limit on an already-busy file gets the same
     question: should this be decomposed first?
   - Never accept a mechanical split ("helpers2.ts", "widget_part_b.dart") as
     satisfying this rule — see the split guidance below.

2. **Do not allow random spaghetti growth in existing code.**
   - Be highly suspicious of new ad-hoc conditionals, scattered special cases, or one-off branches inserted into unrelated flows.
   - If a change adds "weird if statements in random places", treat that as a design problem, not a stylistic nit.
   - Prefer pushing the logic into a dedicated abstraction, helper, state machine, policy object, or separate module instead of tangling an existing path.
   - Call out changes that make the surrounding code harder to reason about, even if they technically work.

3. **Bias toward cleaning the design, not just accepting working code.**
   - If behavior can stay the same while the structure becomes meaningfully cleaner, push for the cleaner version.
   - Do not rubber-stamp "it works" implementations that leave the codebase messier.
   - Strongly prefer simplifications that remove moving pieces altogether over refactors that merely spread the same complexity around.

4. **Prefer direct, boring, maintainable code over hacky or magical code.**
   - Treat brittle, ad-hoc, or "magic" behavior as a code-quality problem.
   - Be skeptical of generic mechanisms that hide simple data-shape assumptions.
   - Flag thin abstractions, identity wrappers, or pass-through helpers that add indirection without buying clarity.

5. **Push hard on type and boundary cleanliness when they affect maintainability.**
   - TypeScript: question unnecessary optionality, `unknown`, `any`, or cast-heavy code when a clearer type boundary could exist.
   - Dart: the same standard applies to `dynamic`, `as` downcasts, and `!` force-unwraps — each one papers over an invariant that should be explicit.
   - Prefer explicit typed models or shared contracts over loosely-shaped ad-hoc objects.
   - If a branch relies on silent fallback to paper over an unclear invariant, ask whether the boundary should be made explicit instead.

6. **Keep logic in the canonical layer and reuse existing helpers.**
   - Call out feature logic leaking into shared paths or implementation details leaking through APIs.
   - Prefer existing canonical utilities/helpers over bespoke one-offs.
   - Push code toward the right package, service, or module instead of normalizing architectural drift.

7. **Treat unnecessary sequential orchestration and non-atomic updates as design smells when the cleaner structure is obvious.**
   - If independent work is serialized for no good reason, ask whether the flow should run in parallel instead.
   - If related updates can leave state half-applied, push for a more atomic structure.
   - Do not over-index on micro-optimizations, but do flag avoidable orchestration complexity that makes the implementation more brittle.

## File & Folder Organization Standards

These are binding rules for this repo, not preferences. The repo already practices
them; the review's job is to stop drift.

1. **Feature-first nesting is canonical.**
   - Web: UI in `components/<feature>/` with sub-concern subfolders (exemplar:
     `components/logging/{feed,input,sidebar}/`); domain/data logic in
     `lib/<feature>/`; hooks in `hooks/<feature>/`; server actions in
     `lib/actions/<feature>/`.
   - Flutter: `lib/features/<feature>/{screens,widgets,...}` with `shared/`,
     `services/`, `models/`, `theme/` reserved for genuinely cross-feature code.
   - New code dropped at the top level of `components/`, `lib/`, or
     `lib/features/<feature>/` when a sub-concern folder exists (or should) is a
     review finding.

2. **Folder size rule: ~8 source files per folder.**
   - When a folder accumulates more than ~8 source files, group them into nested
     subfolders by sub-concern instead of letting the flat list grow.
   - A flat dumping ground of 10+ sibling files is confusing to scan and hides
     ownership — flag it even when every individual file is small.

3. **Separation of concerns per file.**
   - One component/widget per file as the default. A second exported component in
     a file needs a reason.
   - Presentation (components/widgets), state (hooks/controllers), domain and data
     access (lib/services), and orchestration (actions/routes) live in different
     files and different layers.
   - A file mixing fetch logic, a state machine, and JSX/build methods is a split
     candidate regardless of LOC.

4. **Colocation, then promotion.**
   - Feature-private helpers live inside the feature folder next to their consumer.
   - Promote to `lib/` shared / `shared/` only when a **second** consumer actually
     appears — not speculatively.
   - `app/**/_components/` is only for truly page-specific pieces; anything reused
     across routes belongs in `components/<feature>/`.

5. **No barrel files.**
   - No re-export `index.ts` hubs; import directly via the `@/` aliases
     (`@/components`, `@/lib`, `@/hooks`, `@/ui`). Barrels hurt tree-shaking and
     invite cycles (consistent with `vercel-react-best-practices`).
   - Exception: an `index.ts` that IS the module's implementation, not a re-export
     hub.

6. **Naming and tests.**
   - kebab-case filenames on web, snake_case in Dart.
   - Tests colocated: `*.test.ts` next to the source or in a `__tests__/` folder
     mirroring the source path; Flutter tests mirror `lib/` structure under `test/`.

7. **Split along seams, never mechanically.**
   - Good splits reduce the number of concepts per file: pure functions →
     `lib/<feature>/`, subcomponents → sibling files in the same folder,
     stage-per-file for pipelines, one action per file for server-action modules.
   - "part1/part2", "helpers", "utils2", or moving a random half of a widget tree
     into `<name>_extra.dart` are not splits — they scatter one concept across
     files and make things worse. Reject them.

## Primary Review Questions

For every meaningful change, ask:

- Is there a "code judo" move that would make this dramatically simpler?
- Can this change be reframed so fewer concepts, branches, or helper layers are needed?
- Does this improve or worsen the local architecture?
- Did the diff add branching complexity where a better abstraction should exist?
- Did a previously cohesive module become more coupled, more stateful, or harder to scan?
- Is this logic living in the right file, folder, and layer per the organization standards above?
- Did this change push a file toward or past the 400/200 LOC limits, or add the 9th+ file to a flat folder?
- Are there repeated conditionals that signal a missing model or missing helper?
- Is the implementation direct and legible, or does it rely on special cases and incidental control flow?
- Is this abstraction actually earning its keep, or is it just a wrapper?
- Did the diff introduce casts, optionality, or ad-hoc object shapes that obscure the real invariant (TS `any`/`unknown`/casts; Dart `dynamic`/`as`/`!`)?
- Is this logic living in the canonical layer, or did the diff leak details across a boundary?
- Is this orchestration more sequential or less atomic than it needs to be?

## What to Flag Aggressively

Escalate findings when you see:

- A complicated implementation where a cleaner reframing could delete whole categories of complexity.
- Refactors that move code around but fail to reduce the number of concepts a reader must hold in their head.
- A file crossing (or racing toward) 400 LOC — or a component/widget file crossing 200 — due to the PR, especially if the new code could be split out along a real seam.
- A mechanical split done to appease the size gate that scatters one concept across files.
- New files dumped into an already crowded flat folder instead of a sub-concern subfolder.
- Feature-private code parked in `shared/`/`lib/` top level with a single consumer.
- A new barrel `index.ts` re-export hub.
- New conditionals bolted onto unrelated code paths.
- One-off booleans, nullable modes, or flags that complicate existing control flow.
- Feature-specific logic leaking into general-purpose modules.
- Generic "magic" handling that hides simple structure and makes the code harder to reason about.
- Thin wrappers or identity abstractions that add indirection without simplifying anything.
- Unnecessary casts, `any`, `unknown`, `dynamic`, `as`, `!`, or optional params that muddy the real contract.
- Copy-pasted logic instead of extracted helpers.
- Narrow edge-case handling implemented in the middle of an already busy function.
- Refactors that technically pass tests but make the code less modular or less readable.
- "Temporary" branching that is likely to become permanent debt.
- Bespoke helpers where the codebase already has a canonical utility for the job.
- Logic added in the wrong layer/package when it should live somewhere more central.
- Sequential async flow where obviously independent work could stay simpler and clearer with parallel execution.
- Partial-update logic that leaves state less atomic than necessary.

## Preferred Remedies

When you identify a code-quality problem, prefer suggestions like:

- Delete a whole layer of indirection rather than polishing it.
- Reframe the state model so conditionals disappear instead of getting centralized.
- Change the ownership boundary so the feature becomes a natural extension of an existing abstraction.
- Turn special-case logic into a simpler default flow with fewer exceptions.
- Extract a helper or pure function into the feature's `lib/` home.
- Split a large file along a real seam: subcomponents to sibling files, pipeline stages to stage-per-file, server actions to action-per-file.
- Group a crowded flat folder into sub-concern subfolders (the `components/logging/{feed,input,sidebar}/` pattern).
- Move feature-specific logic behind a dedicated abstraction inside the feature folder.
- Replace condition chains with a typed model or explicit dispatcher.
- Separate orchestration from business logic.
- Collapse duplicate branches into a single clearer flow.
- Delete wrappers that do not meaningfully clarify the API.
- Reuse the existing canonical helper instead of introducing a near-duplicate.
- Make type boundaries more explicit so the control flow gets simpler.
- Move the logic to the package/module/layer that already owns the concept.
- Parallelize independent work when that also simplifies the orchestration.
- Restructure related updates into a more atomic flow when partial state would be harder to reason about.

Do not be satisfied with "maybe rename this" feedback when the real issue is structural.
Do not be satisfied with a merely cleaner version of the same messy idea if there is a plausible path to a much simpler idea.

## Review Tone

Be direct, serious, and demanding about quality.
Do not be rude, but do not soften major maintainability issues into mild suggestions.
If the code is making the codebase messier, say so clearly.
If the implementation missed an opportunity for a dramatic simplification, say that clearly too.

Good phrases:

- `this pushes the file past 400 lines (200 for a component). can we decompose this along a real seam first?`
- `this is the 10th file in a flat folder. can we group these by sub-concern like components/logging does?`
- `this split is mechanical — part of one concept moved to a second file. can we split along the actual seam instead?`
- `this adds another special-case branch into an already busy flow. can we move this behind its own abstraction?`
- `this works, but it makes the surrounding code more spaghetti. let's keep the behavior and restructure the implementation.`
- `this feels like feature logic leaking into a shared path. can we isolate it in the feature folder?`
- `this abstraction seems unnecessary. can we just keep the direct flow?`
- `why does this need a cast / optional / force-unwrap here? can we make the boundary more explicit instead?`
- `this looks like a bespoke helper for something we already have elsewhere. can we reuse the canonical one?`
- `i think there's a code-judo move here that makes this much simpler. can we reframe this so these branches disappear?`
- `this refactor moves complexity around, but doesn't really delete it. is there a way to make the model itself simpler?`

## Output Expectations

Prioritize findings in this order:

1. Structural code-quality regressions
2. Missed opportunities for dramatic simplification / code-judo restructuring
3. Spaghetti / branching complexity increases
4. Boundary / abstraction / type-contract problems that make the code harder to reason about
5. File-size, folder-organization, and decomposition concerns
6. Modularity and abstraction issues
7. Legibility and maintainability concerns

Do not flood the review with low-value nits if there are larger structural issues.
Prefer a smaller number of high-conviction comments over a long list of cosmetic notes.
Report pre-existing (base) debt separately from PR findings.

## Approval Bar

Do not approve merely because behavior seems correct.
The bar for approval is:

- no clear structural regression
- no obvious missed opportunity to make the implementation dramatically simpler when such a path is visible
- no unjustified size-limit crossing (400 source / 200 component) and no gate-appeasing mechanical split
- no obvious spaghetti-growth from special-case branching
- no violation of the File & Folder Organization standards (nesting, folder size, colocation, barrels)
- no obviously hacky or magical abstraction that makes the code harder to reason about
- no unnecessary wrapper/cast/optionality churn obscuring the real design
- no clear architecture-boundary leak or avoidable canonical-helper duplication
- no missed opportunity for an obvious decomposition that would materially improve maintainability

Treat these as presumptive blockers unless the author can justify them clearly:

- the PR preserves a lot of incidental complexity when there is a plausible code-judo move that would delete it
- the PR pushes a non-exempt file past 400 LOC, or a component/widget file past 200 LOC, or grows a baselined legacy file
- the PR "fixes" a size violation with a mechanical split instead of a seam split
- the PR adds ad-hoc branching that makes an existing flow more tangled
- the PR solves a local problem by scattering feature checks across shared code
- the PR adds an unnecessary abstraction, wrapper, or cast-heavy contract that makes the design more indirect
- the PR duplicates an existing helper or puts logic in the wrong layer when there is a clear canonical home
- the PR drops new files into a crowded flat folder or introduces a barrel

If those conditions are not met, leave explicit, actionable feedback and push for a cleaner decomposition.
