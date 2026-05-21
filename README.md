# Nham

> The only tracking method accurate enough for Vietnamese home cooking is natural language description.

Nham turns a sentence about what you ate into a structured breakdown of
ingredients, weights, and macros — built around how Vietnamese meals are
actually composed, not how Western food trackers expect them to be.

[![Latest release](https://img.shields.io/github/v/release/VoMinhKhoii/Nham?display_name=tag&sort=semver)](https://github.com/VoMinhKhoii/Nham/releases)
[![CI](https://github.com/VoMinhKhoii/Nham/actions/workflows/ci.yml/badge.svg)](https://github.com/VoMinhKhoii/Nham/actions/workflows/ci.yml)
[![License: Source-Available](https://img.shields.io/badge/license-source--available-blue.svg)](./LICENSE)

## What it does

- **Natural-language meal logging** — describe a meal the way you'd tell a
  friend; Nham extracts ingredients, preparation, and portions.
- **Vietnamese-first ingredient recognition** — a two-stage AI pipeline
  (decompose then ground) matches local foods and dishes that generic
  trackers miss.
- **Macros you can trust** — server-anchored protein and carbs, with
  weight-basis and prep modifiers honored from the original phrasing.
- **Logging UI built for repeat use** — fast input, mode-aware empty
  states, and history that's easy to scan.

## Status

Nham is in active development. Versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html); see
[`CHANGELOG.md`](./CHANGELOG.md) for what shipped in each release.

## Source availability

This repository is published under a **source-available** license
(see [`LICENSE`](./LICENSE)). You may read, fork, build, and run the code
for non-production use. Commercial use, redistribution, or hosting Nham as
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
Composition Table (2007). Bootstrapped with
[`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app)
on Next.js 16 and React 19.
