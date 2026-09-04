# Kallo

> The only tracking method accurate enough for Vietnamese home cooking is natural language description.

Kallo turns a sentence about what you ate into a structured breakdown of
ingredients, weights, and macros. It began around how Vietnamese meals are
actually composed — not how Western food trackers expect them to be — and now
handles meals globally, matching against both FAO and USDA food data with
multilingual input and output.

[![Latest release](https://img.shields.io/github/v/release/VoMinhKhoii/Kallo?display_name=tag&sort=semver)](https://github.com/VoMinhKhoii/Kallo/releases)
[![CI](https://github.com/VoMinhKhoii/Kallo/actions/workflows/ci.yml/badge.svg)](https://github.com/VoMinhKhoii/Kallo/actions/workflows/ci.yml)
[![License: Source-Available](https://img.shields.io/badge/license-source--available-blue.svg)](./LICENSE)

## What it does

- **Natural-language meal logging** — describe a meal the way you'd tell a
  friend; Kallo extracts ingredients, preparation, and portions.
- **Grounded ingredient recognition** — a two-call AI pipeline (decompose,
  then ground against retrieved FAO/USDA candidates) matches local foods and
  dishes that generic trackers miss, with a Vietnamese-first heritage that now
  extends to global cuisines.
- **Details change the estimate** — the words people actually add carry
  through to the numbers. Say `bỏ da` and the fat drops; say `cân sống` and the
  weight basis changes; say `2 chén` and the rice is counted rather than
  assumed from a setting filled in once.
- **Macros you can trust** — server-anchored protein and carbs, bounded
  estimates rather than false precision, with weight-basis and prep modifiers
  honored from the original phrasing.
- **Portions you can see** — an estimate that lands on a container or a cut
  shows the vessel it assumed, at true relative scale, and lets you correct it.
- **Bilingual throughout** — English and Vietnamese, with dish names kept in
  their own language and diacritics intact.
- **Logging UI built for repeat use** — fast input, mode-aware empty states,
  relog, barcode scanning, and history that's easy to scan.

## Repository layout

A Next.js app at the root, with two satellites:

| Path | What it is |
| --- | --- |
| `app/`, `components/`, `lib/` | The web app — Next.js App Router, React 19 |
| `lib/ai/` | The estimation pipeline: decomposition, matching, portions, bounds |
| `apps/mobile-flutter/` | The Flutter mobile client |
| `apps/docs/`, `content/docs/` | The documentation site and its content |
| `supabase/`, `scripts/` | Schema, migrations, and operational scripts |
| `docs/` | Engineering docs — database, billing, email, deploy, data provenance |

Stack: Next.js 16 · React 19 · Drizzle ORM over Supabase Postgres · TanStack
Query · next-intl · Tailwind v4 · Biome · Vitest.

## Running it locally

You need [Bun](https://bun.sh). Running Vitest also requires Node.js 22.12
or newer. A Supabase project plus a Gemini API key are required for anything
that touches the pipeline.

```bash
bun install
bun run setup:env     # scaffolds .env.local
bun run dev           # http://localhost:3000
```

The estimation pipeline needs real food-composition data, which a bare local
Supabase does not have — point `DATABASE_URL` at a seeded project, or expect
matching to return nothing.

Common tasks:

```bash
bun run test            # Vitest
bunx biome check --write <path>   # lint and format; scope it to what you touched
bunx tsc --noEmit       # types
bun run check:structure # size + folder + test-placement + barrel gate, enforced in CI
bun run eval:pipeline   # estimation quality harness
bun run dev:mobile      # Flutter client
```

Database work goes through `bun run db:*` (Drizzle) and `bun run dbr:*`
(remote Supabase). `docs/DATABASE.md` explains which to reach for.

## Status

Kallo is in active development. Versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html); see
[`CHANGELOG.md`](./CHANGELOG.md) for what shipped in each release.

## Source availability

This repository is published under a **source-available** license
(see [`LICENSE`](./LICENSE)). You may read, fork, build, and run the code
for non-production use. Commercial use, redistribution, or hosting Kallo as
a managed service requires a separate agreement — please get in touch.

## Security

Please report suspected vulnerabilities privately — see
[`SECURITY.md`](./SECURITY.md). Do not file public issues for security
problems.

## Contributing

Issues and pull requests are welcome. By submitting code you agree it can
ship under the project's source-available license. Use
[Conventional Commit](https://www.conventionalcommits.org/) messages
(`feat:`, `fix:`, `perf:`, etc.) — they drive the automated changelog.

## Acknowledgements

Nutrient reference data derives in part from the Vietnam National Food
Composition Table (2007) and the USDA FoodData Central database. Bootstrapped
with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app)
on Next.js 16 and React 19.
