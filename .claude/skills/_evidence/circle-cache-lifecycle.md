# Circle cache lifecycle — 2026-11-10

The Circle performance change exposed three reusable test/lifecycle details:

- `tester.pump(duration)` advances timers, not `DateTime.now()`. Freshness tests
  override `queryNowProvider` in
  `apps/mobile-flutter/lib/services/http/query_cache.dart` as well as pumping timers.
- Riverpod 2.6.1's `AsyncNotifier` merges the previous value into an assigned
  `AsyncError`. A terminal access failure must scrub protected entries before
  assigning the error; a retryable refresh failure can retain those entries.
- A successful-result cache alone does not deduplicate rapid return visits
  before the first response. Retain in-flight feed/detail requests until they
  settle, release failures, and preserve explicit invalidation/account boundaries.

Regression evidence lives in `test/features/circle/` under
`apps/mobile-flutter`: `circle_feed_cache_test.dart`,
`circle_feed_refresh_test.dart`, `circle_group_cache_test.dart`, and
`circle_feed_widgets_test.dart`.

Proposed non-redundant addition to `apps/mobile-flutter/AGENTS.md` §4:

> Cache-freshness tests override `queryNowProvider`; pumping Flutter's fake
> timers does not advance `DateTime.now()`. Check both retryable refresh
> failures and access-denied failures: Riverpod's `AsyncError` retains the
> previous value unless it is explicitly cleared.

The measured server baseline is not an after-change benchmark. Per-stage
`Server-Timing` and `circle_feed_timing_v1` logs require a deployment before
uncached production latency can be attributed or compared.

## Web dev benchmark follow-up

The real dev-account web run used first-party HTTP shaping (400 kbps each
direction, 2 s emulated RTT). All 40 cached returns still fetched a route;
their median DOM-readiness latency was 2.82 s. This does not validate Flutter
navigation. Local raw data and the full method are in the ignored
`.playwright-mcp/circle-bench/` artifacts.

Proposed addition for performance evidence: verify the measurement clock and
state whether a result measures DOM readiness, paint, full request wall time
or handler stages. The preview browser's animation callbacks ran near 1 FPS;
the early two-frame timings were discarded. A dev request also spent time
outside the handler stage timers, confirmed by the Next request log and the
gateway's origin timing. Neither result should be presented as production
performance or blamed on SQL alone.
# Web navigation follow-up

User subsequently requested removing the extra families altogether. Removed
Fraunces/Geist Sans/Geist Mono/DM Sans registrations and CSS variables. The
composer plus mention overlay now share font-sans; monospace uses device
fonts without a download. Generated production CSS verified exactly Lora
and Be Vietnam Pro (excluding Next's fallback faces). Build/prerender passed
with the same pre-existing tracing warnings; tests6913 passed/122 skipped,
full tsc, structure, Biome (5 existing warnings), diff checks passed. No new
timing benchmark was run for this final cleanup; do not reuse the earlier
font-preload timing delta as a measured result for removing registrations.

Production-build pass: both optimized builds/prerenders completed. Disabled
preloading of alternate Fraunces, Geist Sans/Mono and legacy DM Sans; primary
Be Vietnam Pro/Lora remain preloaded. Actual Circle font downloads fell from
364268 to 119784 encoded bytes, preloads15 to10. Single fresh-origin trials:
34853.3ms before,31361.1ms after; do not claim a population timing improvement.
Final production-build cached navigation n40: median10.1ms,p9524.4ms, no fetch
before readiness. Rapid10 taps:12.8ms after final tap, no burst fetches.
Full tests6913 passed/122 skipped; tsc, structure, Biome (5 existing warnings)
and diff checks pass. Build tracing warnings in untouched artifact-fetch.mjs
also reached ignored Flutter paths; Circle standalone worked, but this does
not validate meal-pipeline deployment packaging. Evidence:
`.playwright-mcp/circle-bench/production.md`. Proposed durable guidance is
already covered by AGENTS: compare production bundles and record tool limits.

Uncached follow-up: removed the switcher's redundant ambient-wall request,
confirmed absent in both warm and fresh-origin browser loads. Overlapped
visibility-scoped marker/access reads; both still finish before page loading,
and acknowledgment still follows successful enrichment. The first full test
run exposed a membership-gate double that lacked the newly concurrent marker
query; updated that double and verified no marker write after rejection.
Final full Vitest: 6913 passed, 122 skipped; tsc, Biome (5 existing warnings),
structure and diff checks passed. Twelve shaped API probes: all 200, median
2524.6 ms. Four first visits: median 2744.85 ms. Fresh-origin dev initial load
still took 64757.9 ms with 2.67 MB of recorded resources (2.20 MB scripts).
No causal cold-load improvement claim; production assets require their own
benchmark. Evidence: `.playwright-mcp/circle-bench/uncached-follow-up.md`.
Existing AGENTS guidance is sufficient; no new rule proposed for this pass.

The existing feed cache did not eliminate Next route loading. Moving feed
selection into the shared Circle layout and using native history removed RSC
requests for feed-to-feed selections. Browser checks covered Back/Forward,
post-thread navigation and direct group loading. Only the active feed mounts,
so switching does not prefetch and mark unopened groups read.

Slow 3G-like first-party gateway follow-up: 40 cached returns, median 35.75 ms,
p95 46.80 ms, zero fetches started before readiness. Ten rapid taps: final
feed ready 23.9 ms after the last tap, zero burst fetches. This is DOM readiness
in development, not paint, production or Flutter performance. Initial cold
loading was not remeasured. Full Vitest: 6908 passed, 122 skipped.

Proposed durable guidance: when benchmarking a cached navigation, distinguish
route payload waits from feed requests and capture click timestamps in-page.
The follow-up evidence is `.playwright-mcp/circle-bench/follow-up.md`.

