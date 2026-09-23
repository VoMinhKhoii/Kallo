import { z } from 'zod';
import { routeTemplate } from '@/lib/infra/security/csp-report-path';

/**
 * Parsing and sanitizing for browser CSP violation reports
 * (`app/api/csp-report`). Two wire formats reach the collector:
 *
 *  - `application/reports+json` — the Reporting API (`report-to`), a batch:
 *    `[{ type: 'csp-violation', url, body: { documentURL, blockedURL,
 *    effectiveDirective, … } }]`. Chromium sends this one.
 *  - `application/csp-report` — the legacy `report-uri` format, one report:
 *    `{ 'csp-report': { 'document-uri', 'blocked-uri', 'violated-directive',
 *    … } }`. Firefox and Safari still send this one.
 *
 * Both are normalized to one compact `CspViolation`. Every URL is cut to
 * origin + route template: the document URL of a Kallo page can carry a
 * waitlist token or an auth `code` in its query string, or an invite slug in
 * its path, and a blocked URL can carry anything a third party put in its
 * own. A report is written by the
 * browser of whoever loaded the page — which includes an attacker — so nothing
 * here is trusted beyond "a string of bounded length".
 */

/** Longest value kept from any single field, after sanitizing. */
const MAX_FIELD = 256;
/** More than this in one batch is not a real browser; keep the first ones. */
export const MAX_REPORTS_PER_BATCH = 20;

const text = z.string().max(4096);
const optionalText = text.optional();
const optionalNumber = z.number().int().nonnegative().optional();

const legacyReportSchema = z.object({
  'csp-report': z.object({
    'document-uri': text,
    'blocked-uri': optionalText,
    'effective-directive': optionalText,
    'violated-directive': optionalText,
    disposition: optionalText,
    'source-file': optionalText,
    'line-number': optionalNumber,
    'column-number': optionalNumber,
    'status-code': optionalNumber,
  }),
});

const reportingApiEntrySchema = z.object({
  type: text,
  url: optionalText,
  body: z
    .object({
      documentURL: optionalText,
      blockedURL: optionalText,
      effectiveDirective: optionalText,
      disposition: optionalText,
      sourceFile: optionalText,
      lineNumber: optionalNumber,
      columnNumber: optionalNumber,
      statusCode: optionalNumber,
    })
    .optional(),
});

// Accept a slightly oversized batch rather than reject it, but never process
// more than `MAX_REPORTS_PER_BATCH`. A hard cap on array length still bounds
// the validation work.
const reportingApiSchema = z.array(reportingApiEntrySchema).max(100);

export interface CspViolation {
  disposition: 'enforce' | 'report' | 'unknown';
  directive: string;
  document: string;
  blocked: string;
  source?: string;
  line?: number;
  column?: number;
  status?: number;
}

/**
 * Origin + route template of a URL: query string, fragment and credentials
 * gone, and every path segment that is not a known static route word replaced
 * with `:param` (`routeTemplate`) — some Kallo paths carry a capability, such
 * as an invite slug. Non-URL values (`inline`, `eval`, `wasm-eval`) are CSP
 * keywords for what was blocked and pass through; a relative path is
 * templated the same way. Always capped at `MAX_FIELD`.
 */
export function stripUrl(value: string | undefined): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return `${url.origin}${routeTemplate(url.pathname)}`.slice(0, MAX_FIELD);
    }
    // `data:`, `blob:`, `chrome-extension:` … — the scheme is the signal; the
    // rest can be a whole payload.
    return url.protocol;
  } catch {
    const bare = value.split(/[?#]/, 1)[0];
    return (bare.startsWith('/') ? routeTemplate(bare) : bare).slice(
      0,
      MAX_FIELD
    );
  }
}

function disposition(value: string | undefined): CspViolation['disposition'] {
  return value === 'enforce' || value === 'report' ? value : 'unknown';
}

function directive(value: string | undefined): string {
  // `violated-directive` in old reports is the whole directive
  // (`script-src 'self' …`); only its name is worth logging.
  return (value ?? '').trim().split(/\s+/, 1)[0].slice(0, 64) || 'unknown';
}

function compact(violation: CspViolation): CspViolation {
  return Object.fromEntries(
    Object.entries(violation).filter(
      ([, value]) => value !== undefined && value !== ''
    )
  ) as CspViolation;
}

/**
 * Validate a parsed report body against the format its content type names.
 * Throws `ZodError` on a body that is neither. Reporting API entries that are
 * not CSP violations (a browser may batch other report types to the same
 * endpoint) are dropped, not rejected.
 */
export function parseCspReport(
  contentType: 'legacy' | 'reporting-api',
  body: unknown
): CspViolation[] {
  if (contentType === 'legacy') {
    const report = legacyReportSchema.parse(body)['csp-report'];
    return [
      compact({
        disposition: disposition(report.disposition),
        directive: directive(
          report['effective-directive'] ?? report['violated-directive']
        ),
        document: stripUrl(report['document-uri']),
        blocked: stripUrl(report['blocked-uri']),
        source: stripUrl(report['source-file']),
        line: report['line-number'],
        column: report['column-number'],
        status: report['status-code'],
      }),
    ];
  }

  return reportingApiSchema
    .parse(body)
    .filter((entry) => entry.type === 'csp-violation' && entry.body)
    .slice(0, MAX_REPORTS_PER_BATCH)
    .map(({ url, body: report = {} }) =>
      compact({
        disposition: disposition(report.disposition),
        directive: directive(report.effectiveDirective),
        document: stripUrl(report.documentURL ?? url),
        blocked: stripUrl(report.blockedURL),
        source: stripUrl(report.sourceFile),
        line: report.lineNumber,
        column: report.columnNumber,
        status: report.statusCode,
      })
    );
}

/**
 * Which format a `Content-Type` names, or `null` for anything else. Matches
 * the media type only, ignoring parameters (`; charset=utf-8`).
 */
export function cspReportFormat(
  contentType: string | null
): 'legacy' | 'reporting-api' | null {
  const mediaType = contentType?.split(';', 1)[0].trim().toLowerCase();
  if (mediaType === 'application/csp-report') return 'legacy';
  if (mediaType === 'application/reports+json') return 'reporting-api';
  return null;
}
