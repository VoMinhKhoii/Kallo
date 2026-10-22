// Opens routes in a real browser against a running dev server, at phone and
// desktop width, signed in as the dev evidence account unless --signed-out.
// Saves a screenshot per route and width, and fails when a page errors, loses
// the session, scrolls sideways or shows a broken image.
//
//   node --env-file=.env.local scripts/dev/evidence/capture-web.mjs \
//     [--base-url http://localhost:3000] [--out <dir>] [--width phone|desktop]
//     [--signed-out] [--full-page] [--theme light|dark|aurora]
//     [--allow <text>] /en/logging /en/dashboard
//
// --theme sets Settings → Appearance before each page loads (the app pages
// honour it; the marketing site stays light) and adds it to the file names.
// --allow excuses an issue whose text contains <text>, for problems already
// shown to happen on main; the report still lists them.
//
// docs/REAL_RUN_EVIDENCE.md has the whole recipe.

import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { judge, reportMarkdown } from './findings.mjs';
import { signInPath } from './sign-in.mjs';

const VIEWPORTS = {
  phone: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
};
// The first visit to a route compiles it in `next dev`, which can take a minute.
const FIRST_LOAD_MS = 120_000;

const { values, positionals: routes } = parseArgs({
  allowPositionals: true,
  options: {
    'base-url': { type: 'string', default: 'http://localhost:3000' },
    out: { type: 'string' },
    width: { type: 'string', multiple: true },
    'signed-out': { type: 'boolean', default: false },
    'full-page': { type: 'boolean', default: false },
    allow: { type: 'string', multiple: true, default: [] },
    theme: { type: 'string' },
  },
});

const THEMES = ['light', 'dark', 'aurora'];

const base = values['base-url'].replace(/\/$/, '');
const widths = values.width ?? Object.keys(VIEWPORTS);
const out = values.out ?? join(tmpdir(), 'kallo-evidence', String(Date.now()));
const signedIn = !values['signed-out'];

if (routes.length === 0 || routes.some((r) => !r.startsWith('/'))) {
  fail('Pass one or more routes starting with "/", e.g. /en/logging.');
}
const unknown = widths.filter((w) => !(w in VIEWPORTS));
if (unknown.length > 0)
  fail(`Unknown --width ${unknown.join(', ')}; use phone or desktop.`);
if (values.theme && !THEMES.includes(values.theme))
  fail(`Unknown --theme ${values.theme}; use ${THEMES.join(', ')}.`);
// The base URL is itself a first load on a fresh `next dev` (10 s measured),
// so it gets the same allowance; only a refused connection means no server.
await fetch(base, { signal: AbortSignal.timeout(FIRST_LOAD_MS) }).catch(
  (error) =>
    fail(
      error.name === 'TimeoutError'
        ? `${base} did not answer within ${FIRST_LOAD_MS / 1000} s.`
        : `Nothing answers at ${base}. Start the dev server first (bun dev).`
    )
);

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
try {
  const storageState = signedIn ? await signIn(browser) : undefined;
  const observations = [];
  for (const width of widths) {
    const context = await browser.newContext({
      ...VIEWPORTS[width],
      storageState,
    });
    if (values.theme) {
      // The same key Settings → Appearance writes (lib/core/theme/themes.ts).
      await context.addInitScript((theme) => {
        localStorage.setItem('kallo-theme', theme);
      }, values.theme);
    }
    for (const route of routes) {
      observations.push(await observe(context, route, width));
    }
    await context.close();
  }
  const report = reportMarkdown(observations, values.allow);
  writeFileSync(join(out, 'report.md'), `${report}\n`);
  writeFileSync(
    join(out, 'report.json'),
    `${JSON.stringify(observations, null, 2)}\n`
  );
  process.stdout.write(`${report}\nScreenshots and report: ${out}\n`);
  const failed = observations.some(
    (o) => judge(o, values.allow).issues.length > 0
  );
  process.exitCode = failed ? 1 : 0;
} finally {
  await browser.close();
}

/** Signs in once and returns the session for every width's context. */
async function signIn(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}${await signInPath(routes[0])}`, {
    timeout: FIRST_LOAD_MS,
  });
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/'), {
    timeout: FIRST_LOAD_MS,
  });
  const state = await context.storageState();
  await context.close();
  return state;
}

/**
 * Loads one route in a fresh tab and records what went wrong on it. A capture
 * that throws is recorded too, so one bad page never loses the others' report.
 */
async function observe(context, route, width) {
  const page = await context.newPage();
  /** @type {import('./findings.mjs').Observation} */
  const observation = {
    route,
    viewport: width,
    status: null,
    finalPath: route,
    signedIn,
    consoleErrors: [],
    pageErrors: [],
    serverErrors: [],
    failedRequests: [],
    overflowPx: 0,
    brokenImages: [],
    screenshot: '—',
    captureError: null,
  };
  page.on('console', (m) => {
    if (m.type() === 'error') observation.consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => observation.pageErrors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 500)
      observation.serverErrors.push(`${r.status()} ${r.url()}`);
  });
  page.on('requestfailed', (r) => {
    const reason = r.failure()?.errorText ?? 'failed';
    // Navigations and prefetches the page itself cancelled.
    if (reason !== 'net::ERR_ABORTED')
      observation.failedRequests.push(`${reason} ${r.url()}`);
  });

  try {
    const response = await page.goto(`${base}${route}`, {
      timeout: FIRST_LOAD_MS,
    });
    observation.status = response?.status() ?? null;
    await page
      .waitForLoadState('networkidle', { timeout: 15_000 })
      .catch(() => {});
    // Entrance animations settle before the screenshot.
    await page.waitForTimeout(800);
    Object.assign(
      observation,
      await page.evaluate(() => ({
        // clientWidth, not innerWidth: a phone browser zooms out to fit a page
        // that is too wide, which stretches innerWidth to the content.
        overflowPx:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
        brokenImages: [...document.images]
          .filter(
            (img) => img.complete && img.naturalWidth === 0 && img.currentSrc
          )
          .map((img) => img.currentSrc),
      }))
    );
    // Next's dev badge would sit over every screenshot.
    await page.addStyleTag({
      content: 'nextjs-portal { display: none !important; }',
    });
    const slug =
      route.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-') || 'root';
    const name = `${slug}-${width}${values.theme ? `-${values.theme}` : ''}.png`;
    await page.screenshot({
      path: join(out, name),
      fullPage: values['full-page'],
    });
    observation.screenshot = name;
    const landed = new URL(page.url());
    observation.finalPath = `${landed.pathname}${landed.search}`;
  } catch (error) {
    observation.captureError =
      error instanceof Error ? error.message : String(error);
  } finally {
    await page.close();
  }
  return observation;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}
