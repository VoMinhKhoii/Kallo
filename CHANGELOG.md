# Changelog

## [1.2.0](https://github.com/VoMinhKhoii/Nham/compare/v1.1.0...v1.2.0) (2026-06-02)


### Features

* **api:** add /api/v1 REST surface with Bearer auth for mobile ([47dd6ab](https://github.com/VoMinhKhoii/Nham/commit/47dd6abc9060aec2fcd4acabae49b0a79555fb84))
* **api:** add aggregate GET /api/v1/dashboard endpoint ([53ea8e3](https://github.com/VoMinhKhoii/Nham/commit/53ea8e33b759f88776dbf30920def70008a7daa0))
* **auth:** thread invite return-path through sign-in/up and OAuth ([5b1b0d0](https://github.com/VoMinhKhoii/Nham/commit/5b1b0d048d1d74628c6035ebf037883631112af6))
* **groups:** add /api/v1/groups REST API, services, and hooks ([c91e3b6](https://github.com/VoMinhKhoii/Nham/commit/c91e3b6d4438653a3612a608b0dd7990748b2165))
* **groups:** add Circle social data model, RLS, and isolation tests ([f33b1e1](https://github.com/VoMinhKhoii/Nham/commit/f33b1e12e714afc727b08da38d040141f9b6cf1b))
* **groups:** add Circle wall, add-friend, and post-save share toggle UI ([cb890fe](https://github.com/VoMinhKhoii/Nham/commit/cb890fe9673a2bf0cb2f6a1cc9cc632979b1df63))
* **groups:** add claim-handle flow and a functional invite link ([782ed37](https://github.com/VoMinhKhoii/Nham/commit/782ed37ec91b207a8c16d76f6670873a55ebe258))
* **groups:** add Macro Card OG image and native share ([d5342fe](https://github.com/VoMinhKhoii/Nham/commit/d5342fe3942d1a6e19833237038a5e539cf56608))
* **groups:** add skeleton loading to the circle wall ([7cd3dc4](https://github.com/VoMinhKhoii/Nham/commit/7cd3dc482e603bad2b342e4de155d740d1c8af9d))
* **groups:** Circle social layer — opt-in meal sharing, friends, Macro Card ([f927f78](https://github.com/VoMinhKhoii/Nham/commit/f927f78738d89f97c32f0503ac555dabd02e248c))
* **groups:** replace handle search with Locket-style link invites ([a5a107f](https://github.com/VoMinhKhoii/Nham/commit/a5a107fdf9af2e7bd04ff7ad682386c1a8870e46))
* **groups:** scope the handle directory behind RLS + exact-match RPC ([d06badd](https://github.com/VoMinhKhoii/Nham/commit/d06baddd45a43553dfebc9f6542125abae8a91dc))
* **mobile:** dashboard + weight surface (Phase 4) ([9ee7aac](https://github.com/VoMinhKhoii/Nham/commit/9ee7aac6049a5ba6ef738cb26ae419444a978602))
* **mobile:** dashboard aggregate fetch, perf fixes, folder reorg ([9308a83](https://github.com/VoMinhKhoii/Nham/commit/9308a83c60a333a89c60f491a383a139695cf4a5))
* **mobile:** design-system foundation (tokens, fonts, primitives) ([eb6544b](https://github.com/VoMinhKhoii/Nham/commit/eb6544b274430f86978743f4fe95d6b2542c5c5f))
* **mobile:** i18n-migrate auth, logging, and today-section strings ([5e7d47e](https://github.com/VoMinhKhoii/Nham/commit/5e7d47edb71dbcc272f021443a8a808f5f4d04ff))
* **mobile:** logging date chip + date selection + meal-card fidelity ([c877ad9](https://github.com/VoMinhKhoii/Nham/commit/c877ad96ceefe788f5ab8afc6e9e7feca0b05e40))
* **mobile:** logging wedge — streaming meal analysis, feed, confirm ([87972ce](https://github.com/VoMinhKhoii/Nham/commit/87972ce731e500d8406ecab262db0dc348005ec8))
* **mobile:** match logging UI 1:1 to web mobile view ([237a065](https://github.com/VoMinhKhoii/Nham/commit/237a065330c5efb41b8e6b1449090d2ff3874342))
* **mobile:** Phase 6 — observability, locale-from-profile, warmup, EAS config ([804833f](https://github.com/VoMinhKhoii/Nham/commit/804833fc6a5e496897a8026053314ae09729baf7))
* **mobile:** port nutrition screen 1:1 from web (Phase 5a) ([ee53abc](https://github.com/VoMinhKhoii/Nham/commit/ee53abc9c54668534b66c056ede8f29a5a9d25fb))
* **mobile:** port onboarding wizard 1:1 from web (Phase 5c) ([857c73c](https://github.com/VoMinhKhoii/Nham/commit/857c73c74f9bcdaa51e61db1ea61d827e1b61c7b))
* **mobile:** port settings (profile) screen 1:1 from web (Phase 5b) ([b553f45](https://github.com/VoMinhKhoii/Nham/commit/b553f4593f18e72d3a68d1a0a3c0d82facd5a0f6))
* **mobile:** re-port weight card + 90d heatmap 1:1 from web ([2d824b1](https://github.com/VoMinhKhoii/Nham/commit/2d824b122d34a5f815936440c4108634cf70f710))
* **mobile:** React Native/Expo app + /api/v1 REST surface ([d816b29](https://github.com/VoMinhKhoii/Nham/commit/d816b29521adb7aeba9a0c0f6fd5467961226be1))
* **mobile:** replace bottom tabs with hamburger + drawer sidebar ([77539f8](https://github.com/VoMinhKhoii/Nham/commit/77539f86631f2a3a012d48dca8744519c79dfada))
* **mobile:** scaffold Expo app with Supabase auth + REST client ([95a145e](https://github.com/VoMinhKhoii/Nham/commit/95a145e5f3fec0f002edf0910e98b8dc4f42bac7))
* **mobile:** wire i18n via use-intl + shared message catalogs ([e414479](https://github.com/VoMinhKhoii/Nham/commit/e414479edcb67f231bf013697eff536824503382))
* under-logged day handling, logging warnings, and settings rework ([e8feacc](https://github.com/VoMinhKhoii/Nham/commit/e8feacc209b6284e79555fef6767eb24ce8a3b74))


### Bug Fixes

* **dashboard:** prevent crash when weight input has a numeric default ([4fd722b](https://github.com/VoMinhKhoii/Nham/commit/4fd722be73461e9335d93bcdcd082e51c8c85063))
* **dashboard:** prevent crash when weight input has a numeric default ([10f6f18](https://github.com/VoMinhKhoii/Nham/commit/10f6f18e304b33a363a65601186e505251c0f819))
* **groups:** add retryable error states and clearer auth/empty copy ([33bb9e3](https://github.com/VoMinhKhoii/Nham/commit/33bb9e304bf20d221b6e4aaa59f64f0c2080b084))
* **groups:** address CodeRabbit review on the Circle layer ([d096592](https://github.com/VoMinhKhoii/Nham/commit/d0965923509516db44bc480d6014af2d46364be1))
* **groups:** drop the @ prefix from circle labels ([79e0bdf](https://github.com/VoMinhKhoii/Nham/commit/79e0bdf1cb8bf2a0d402f23daec35600453c9b0f))
* **groups:** harden acceptInvite, normalize ids, fan out re-shares ([f30a1f4](https://github.com/VoMinhKhoii/Nham/commit/f30a1f4dce42e82a0193bbcbb797e9b3c4c4d8ed))
* **groups:** render the Macro Card (Satori display:flex on multi-child node) ([76cba9e](https://github.com/VoMinhKhoii/Nham/commit/76cba9ed86302deba913c97e6d95d83ad936e626))
* **groups:** seed the share toggle from real server state ([5eaf7f8](https://github.com/VoMinhKhoii/Nham/commit/5eaf7f8297db3565c005b4f9bb4b9f9ca557f46d))
* **groups:** tighten feed cache key, handle constant, RLS doc, request toast ([4dce2a6](https://github.com/VoMinhKhoii/Nham/commit/4dce2a6a9cec523b5dd8250b8878a18287865973))
* **logging:** confirm server-loaded pending meals and survive malformed rows ([d700dd9](https://github.com/VoMinhKhoii/Nham/commit/d700dd9906afdc2ae777af592026fcd53281c723))
* **logging:** confirm server-loaded pending meals and survive malformed rows ([0912056](https://github.com/VoMinhKhoii/Nham/commit/0912056a433bc9ad5015be39257cce22e8bff55a))
* **logging:** guard double-submit and clarify optimistic seed comment ([ae4390e](https://github.com/VoMinhKhoii/Nham/commit/ae4390e7181e86dff343075bf3668475fbbbba4e))
* **logging:** keep calorie ring in sync after saving the first meal ([0d3c72e](https://github.com/VoMinhKhoii/Nham/commit/0d3c72eaca98196fec8e8519c4b9e8ae072aeffa))
* **mobile:** address CodeRabbit review findings on [#139](https://github.com/VoMinhKhoii/Nham/issues/139) ([f5080e6](https://github.com/VoMinhKhoii/Nham/commit/f5080e683b60615b95f3052add972876749d3343))
* **mobile:** full-width timeline strip on expand + input clears home indicator ([98d0dc1](https://github.com/VoMinhKhoii/Nham/commit/98d0dc11729e98868051386098d8ec22e6b1130d))
* **mobile:** interaction + sizing fidelity pass across nutrition/dashboard/logging ([0aed0f9](https://github.com/VoMinhKhoii/Nham/commit/0aed0f965a6f9ef2aa3666c337ae74bdf81211a4))
* **mobile:** route to /logging after email sign-in ([0a3ec2c](https://github.com/VoMinhKhoii/Nham/commit/0a3ec2c760eaded972b096683fd56b15c6e199f6))
* **mobile:** tap-outside collapses the expanded timeline strip ([5b58fba](https://github.com/VoMinhKhoii/Nham/commit/5b58fba766f569b783bc09cefddf41d58551a39d))
* **mobile:** use explicit insets for timeline collapse scrim (RN 0.85 lacks StyleSheet.absoluteFillObject typing) ([dfed72b](https://github.com/VoMinhKhoii/Nham/commit/dfed72bbc5803f0110312cedf89da3b87611c10b))


### Performance

* **groups:** index friendship reverse lookups and the meal-share feed scan ([0522b2b](https://github.com/VoMinhKhoii/Nham/commit/0522b2b3a9e851f5d1288a802dc4a6e092a29fd0))


### Refactor

* **groups:** extract shared readJsonBody route helper ([0422549](https://github.com/VoMinhKhoii/Nham/commit/0422549758b3bbb9d7cbe44949cb10ef5da18ca1))
* **groups:** share readJsonBody and safeNextPath helpers ([775d03d](https://github.com/VoMinhKhoii/Nham/commit/775d03d215c435eb2842fb61869d240b0ba76316))


### Documentation

* **agents:** record Satori OG gotchas and the link-invite decision ([acf89f4](https://github.com/VoMinhKhoii/Nham/commit/acf89f450d562a415ba3a1fcaedda0f393d43357))
* **agents:** require /nham-design for any UI or design work ([c7b7d87](https://github.com/VoMinhKhoii/Nham/commit/c7b7d87cbe01c84194c25b5d39f767efee12aaa2))
* **groups:** add decision record and build plan ([16680c6](https://github.com/VoMinhKhoii/Nham/commit/16680c63bc99620610298896084164d878ba0661))
* **mobile:** add verified React Native / Expo port plan ([992d9c2](https://github.com/VoMinhKhoii/Nham/commit/992d9c2667d3724fa86a5b7246b4377e8d39688f))

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
