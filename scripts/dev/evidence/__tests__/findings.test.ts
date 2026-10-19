import { describe, expect, it } from 'vitest';
import { issuesFor, judge, reportMarkdown } from '../findings.mjs';

const clean = {
  route: '/en/logging',
  viewport: 'phone',
  status: 200,
  finalPath: '/en/logging',
  signedIn: true,
  consoleErrors: [],
  pageErrors: [],
  serverErrors: [],
  failedRequests: [],
  overflowPx: 0,
  brokenImages: [],
  screenshot: 'en-logging-phone.png',
  captureError: null,
};

describe('issuesFor', () => {
  it('finds nothing on a clean page', () => {
    expect(issuesFor(clean)).toEqual([]);
  });

  it('flags a page that could not be captured', () => {
    expect(
      issuesFor({
        ...clean,
        status: null,
        captureError: 'page.goto: Timeout 120000ms exceeded.',
      })
    ).toEqual(['capture failed: page.goto: Timeout 120000ms exceeded.']);
  });

  it('flags an error status', () => {
    expect(issuesFor({ ...clean, status: 404 })).toEqual(['HTTP 404']);
  });

  it('flags a signed-in capture that was sent to sign in', () => {
    expect(issuesFor({ ...clean, finalPath: '/en/sign-in' })).toEqual([
      'landed on /en/sign-in: the session did not hold',
    ]);
  });

  it('accepts a signed-out capture of the sign-in page', () => {
    expect(
      issuesFor({
        ...clean,
        signedIn: false,
        route: '/en/sign-in',
        finalPath: '/en/sign-in',
      })
    ).toEqual([]);
  });

  it('accepts a redirect to another app page', () => {
    expect(
      issuesFor({ ...clean, route: '/en', finalPath: '/en/logging' })
    ).toEqual([]);
  });

  it('lists each repeated error once', () => {
    const issues = issuesFor({
      ...clean,
      consoleErrors: ['boom', 'boom'],
      pageErrors: ['TypeError: x is undefined'],
    });
    expect(issues).toEqual([
      'uncaught error: TypeError: x is undefined',
      'console error: boom',
    ]);
  });

  it('flags failed requests and server errors', () => {
    const issues = issuesFor({
      ...clean,
      serverErrors: ['500 http://localhost:3000/api/x'],
      failedRequests: ['net::ERR_FAILED http://localhost:3000/a.webp'],
    });
    expect(issues).toEqual([
      'server error: 500 http://localhost:3000/api/x',
      'request failed: net::ERR_FAILED http://localhost:3000/a.webp',
    ]);
  });

  it('ignores one pixel of overflow but flags a sideways scroll', () => {
    expect(issuesFor({ ...clean, overflowPx: 1 })).toEqual([]);
    expect(issuesFor({ ...clean, overflowPx: 48 })).toEqual([
      'page scrolls sideways by 48px',
    ]);
  });

  it('keeps only the first line of a multi-line error', () => {
    expect(
      issuesFor({
        ...clean,
        consoleErrors: ['Error: boom\n    at x (a.js:1:1)'],
      })
    ).toEqual(['console error: Error: boom']);
  });

  it('flags a broken image', () => {
    expect(
      issuesFor({ ...clean, brokenImages: ['http://localhost:3000/p.webp'] })
    ).toEqual(['image did not load: http://localhost:3000/p.webp']);
  });
});

describe('judge', () => {
  it('excuses issues matching an allow pattern and keeps the rest', () => {
    const observation = {
      ...clean,
      consoleErrors: ['Error: known on main', 'Error: new'],
    };
    expect(judge(observation, ['known on main'])).toEqual({
      issues: ['console error: Error: new'],
      allowed: ['console error: Error: known on main'],
    });
  });
});

describe('reportMarkdown', () => {
  it('counts and lists allowed issues apart from the ones that fail', () => {
    const report = reportMarkdown(
      [{ ...clean, consoleErrors: ['Error: known on main'] }],
      ['known']
    );
    expect(report).toContain('| ok, 1 allowed |');
    expect(report).toContain(
      '- allowed, also on main: console error: Error: known on main'
    );
  });

  it('writes a row per screenshot and details only for pages with issues', () => {
    const report = reportMarkdown([
      clean,
      {
        ...clean,
        viewport: 'desktop',
        overflowPx: 20,
        screenshot: 'en-logging-desktop.png',
      },
      {
        ...clean,
        route: '/en',
        finalPath: '/en/logging',
        screenshot: 'en-phone.png',
      },
    ]);
    expect(report).toContain(
      '| `/en/logging` | phone | 200 | ok | en-logging-phone.png |'
    );
    expect(report).toContain(
      '| `/en/logging` | desktop | 200 | 1 issue(s) | en-logging-desktop.png |'
    );
    expect(report).toContain(
      '| `/en` → /en/logging | phone | 200 | ok | en-phone.png |'
    );
    expect(report).toContain(
      '### `/en/logging` (desktop)\n- page scrolls sideways by 20px'
    );
    expect(report).not.toContain('### `/en/logging` (phone)');
  });
});
