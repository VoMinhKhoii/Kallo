# Changelog

## [1.1.0](https://github.com/VoMinhKhoii/Nham/compare/v1.0.1...v1.1.0) (2026-05-27)


### Features

* **log:** demote Confirm to ghost style while editing + debounce taps ([ef27782](https://github.com/VoMinhKhoii/Nham/commit/ef277827e732f154d6c171a25e3c3d2a3506be59))
* **log:** mobile layout & typography fixes ([#123](https://github.com/VoMinhKhoii/Nham/issues/123)) ([51c5480](https://github.com/VoMinhKhoii/Nham/commit/51c54807ed47c5db09c890a50d59553dc55c80b0))
* **nutrition:** exclude under-logged days from long-span metrics ([68bc85a](https://github.com/VoMinhKhoii/Nham/commit/68bc85a1726096f15985b8d8f03061d0dbb8c06b))
* **settings:** tabbed profile sections, two-level nav, clearer targets ([fc51b1f](https://github.com/VoMinhKhoii/Nham/commit/fc51b1f928427d19920b99ceac32428cc7f0111c))


### Bug Fixes

* accept comma decimal input on iOS and validate body metrics ([c517702](https://github.com/VoMinhKhoii/Nham/commit/c517702954708c1caca5f184e61f8af12d137bd5))
* **auth:** persist iOS home-screen sessions ([#121](https://github.com/VoMinhKhoii/Nham/issues/121)) ([b8d0d8b](https://github.com/VoMinhKhoii/Nham/commit/b8d0d8ba7737f19681a4d0f4741f884df245bf67))
* **ci:** disable Biome formatter for package.json ([#118](https://github.com/VoMinhKhoii/Nham/issues/118)) ([8da8c9a](https://github.com/VoMinhKhoii/Nham/commit/8da8c9af93b083a93401ad2159cadfea28fe88f3))
* **ci:** match biome 2.4.2 formatter for app/globals.css ([10c26d8](https://github.com/VoMinhKhoii/Nham/commit/10c26d8941e9cf4d438142634ea78a427a4ad87e))
* **dashboard:** render and polish the weight trend chart ([#124](https://github.com/VoMinhKhoii/Nham/issues/124)) ([f1c2988](https://github.com/VoMinhKhoii/Nham/commit/f1c298883bc680e2d1d6805bafc80322f1aecf1b))
* **deps:** patch security advisories and sync bun.lock ([cc90d11](https://github.com/VoMinhKhoii/Nham/commit/cc90d113c2c08c12fad195f14c31720513641781))
* **log:** enforce MIN_DISH_GRAMS floor in applyQuantityChange for g/ml ([96e9cc9](https://github.com/VoMinhKhoii/Nham/commit/96e9cc904c54fc4b8dccdab2680df5851ad2eb65))
* **log:** keep one stable key for saved meal card to kill the re-fade ([5f77171](https://github.com/VoMinhKhoii/Nham/commit/5f77171fdc604c5adb4fc01a2090e997d6f78111))
* **log:** persist meal card edits and drop the extra save step ([a280049](https://github.com/VoMinhKhoii/Nham/commit/a2800498a289647b48dbc6c291c456ffe3d5e02d))
* **log:** reflect edited quantities in optimistic meal card ([c01b52f](https://github.com/VoMinhKhoii/Nham/commit/c01b52f15df5c10b5fd1c5c8d26b645986de3bb5))
* **log:** stop saved meal card from re-fading after confirm ([9e5fce8](https://github.com/VoMinhKhoii/Nham/commit/9e5fce8d7410de5960fdde4177c9e5515cb62781))
* **mobile:** scope zoom-prevention rule to text-entry inputs ([6a1b5da](https://github.com/VoMinhKhoii/Nham/commit/6a1b5dac4fa8b076bf385a8df7476f49faad526f))
* **mobile:** stop input focus auto-zoom on iOS/Android ([e83020b](https://github.com/VoMinhKhoii/Nham/commit/e83020be0a68093d3c7ddc2a0011e303195749a0))
* **settings:** address pre-PR review — a11y, validation gate, contrast ([797fc9f](https://github.com/VoMinhKhoii/Nham/commit/797fc9fdecb7094a3d09ea0210a5f8ba52ab0f6b))
* **settings:** give medium/small screens room to breathe ([4de1126](https://github.com/VoMinhKhoii/Nham/commit/4de1126c21e8a4a0325d80d753c2d5842fe59d57))
* **settings:** stop horizontal overflow, pin save bar, polish nav + mobile ([55ae6c9](https://github.com/VoMinhKhoii/Nham/commit/55ae6c968e9e28bd76d7e08346cc87a66f61418e))


### Performance

* **ai:** cut v2 matching latency from 13-15s to ~2-3s warm ([#120](https://github.com/VoMinhKhoii/Nham/issues/120)) ([0256bf3](https://github.com/VoMinhKhoii/Nham/commit/0256bf3a705c0a7228ec033e07ec5f84f71f72ec))
* **ai:** pre-warm matching caches at boot + phase timings ([#122](https://github.com/VoMinhKhoii/Nham/issues/122)) ([c346f0d](https://github.com/VoMinhKhoii/Nham/commit/c346f0ddb1dd7b8056c54b30faee302f3a166eb2))


### Refactor

* **log:** address pre-PR review findings on meal-card edit ([c8c374d](https://github.com/VoMinhKhoii/Nham/commit/c8c374d69483800f771dae805790149adc27c998))


### Documentation

* **agents:** add release-please version bumping rule of thumb ([#115](https://github.com/VoMinhKhoii/Nham/issues/115)) ([14b051f](https://github.com/VoMinhKhoii/Nham/commit/14b051f927d9125d6dea7752e1510a3b90a12df9))

## [1.0.1](https://github.com/VoMinhKhoii/Nham/compare/v1.0.0...v1.0.1) (2026-05-21)


### Bug Fixes

* **ci:** restore single-line array formatting in package.json ([#116](https://github.com/VoMinhKhoii/Nham/issues/116)) ([2d0a37c](https://github.com/VoMinhKhoii/Nham/commit/2d0a37cc8cae196c864e1f35551fcf3140140f76))

## 1.0.0 (2026-05-21)


### Features

* **ai:** honor user-typed weight basis and prep modifiers in macros ([04be548](https://github.com/VoMinhKhoii/Nham/commit/04be5489d7b09bceb96445a744d9a1f9996e4e55))
* **ai:** make v2 default, fix streaming buffer, capitalize names, wire pipeline_runs ([4bce450](https://github.com/VoMinhKhoii/Nham/commit/4bce450951bf03023360f89fd388a84104387cae))
* **ai:** pipeline v2 — pure-decompose Call 1 + CRAG-grounded Call 2 ([7aa67a9](https://github.com/VoMinhKhoii/Nham/commit/7aa67a9d3219c121fbe2a1df040cbb6e53ebfb15))
* **ai:** scaffold pipeline v2 (pure decompose + grounded estimation + CRAG) ([3da1790](https://github.com/VoMinhKhoii/Nham/commit/3da179056486f52d44c5668f854486ab17b78593))
* **ai:** v2 incremental streaming + slim Call 1 user_context + dispatch log ([5c030e0](https://github.com/VoMinhKhoii/Nham/commit/5c030e0627f882d1bdeb19652189e656af29bae4))
* **ai:** v2 stage logs + language guard + chunk-count probe (parity with v1) ([602709c](https://github.com/VoMinhKhoii/Nham/commit/602709cb79753ba59e3fb165339c734bb550d5ae))
* **ai:** wire v2 pipeline (top-K matching, CRAG bridge, orchestrator dispatch) ([eeb13ee](https://github.com/VoMinhKhoii/Nham/commit/eeb13ee3fec76005fe0866256dc3dec463ca3d4c))


### Bug Fixes

* address CodeRabbit review comments on PR [#112](https://github.com/VoMinhKhoii/Nham/issues/112) ([893a6c3](https://github.com/VoMinhKhoii/Nham/commit/893a6c310761646e49c81978c8295837f989480c))
* **ai:** post-review hardening + drop v2- prefix + admin pipeline-version badge ([eb94c6a](https://github.com/VoMinhKhoii/Nham/commit/eb94c6af50b3a910485828bc5e7b5d67a817ace2))
* correct contact email in LICENSE and SECURITY ([91ac6d1](https://github.com/VoMinhKhoii/Nham/commit/91ac6d199a2197ed2b4c10c2c12e3779636ab9b0))


### Documentation

* **agents:** add branch naming convention (type/short-slug) ([5b8550a](https://github.com/VoMinhKhoii/Nham/commit/5b8550aad39ca921a7faa38940ad894d427cc024))

## Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file is maintained automatically by [release-please](https://github.com/googleapis/release-please).
New entries are generated from [Conventional Commit](https://www.conventionalcommits.org/) messages on `main`.
