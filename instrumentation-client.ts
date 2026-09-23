import { z } from 'zod';

/**
 * Runs in the browser before the app hydrates (Next's client instrumentation
 * hook).
 *
 * Zod 4 feature-detects a JIT for object schemas by calling `new Function('')`
 * on first parse. The enforced CSP (lib/infra/security/csp.ts) has no
 * `'unsafe-eval'`, so that probe is refused — Zod catches it and falls back,
 * but the browser still files a `script-src` violation and a report to
 * `/api/csp-report` on every page that parses a schema. `jitless` skips the
 * probe; parsing already ran without the JIT under this policy, so nothing
 * changes except the noise.
 */
z.config({ jitless: true });
