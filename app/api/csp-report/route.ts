import type { NextRequest } from 'next/server';
import { handleRouteError } from '@/lib/api/respond';
import { Errors } from '@/lib/core/errors/catalog';
import { readBoundedJson } from '@/lib/infra/http/bounded-body';
import { assertRateLimit } from '@/lib/infra/rate-limit/limiter/limiter';
import {
  cspReportFormat,
  parseCspReport,
} from '@/lib/infra/security/csp-report';
import { getRequestIp } from '@/lib/infra/security/request-ip';

/**
 * A browser batch of a few violations, each echoing the ~1 KB policy, fits in
 * a fraction of this. Anything larger is not a browser.
 */
const MAX_BODY_BYTES = 32 * 1024;

/**
 * CSP violation collector — the `report-to` / `report-uri` target of the
 * enforced policy in `lib/infra/security/csp.ts`.
 *
 * Anonymous by necessity: the browser sends reports without cookies for a page
 * anyone can load, including the signed-out landing page. That makes it a
 * public write endpoint into our logs, so it is bounded three ways: the body
 * cap above (413), `cspReportIp` per source IP (429), and a per-batch cap on
 * how many violations are logged (`MAX_REPORTS_PER_BATCH`). `cspReportIp` is
 * a `memory` policy — a report must never cost a database round trip.
 *
 * The log line is compact and sanitized (`parseCspReport`): origin + path
 * only, never a query string, so a report cannot copy a token from the page
 * URL into the logs. The sample of the blocked script is not kept.
 *
 * Success is 204 with no body; nothing reads it.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getRequestIp(request);
    if (ip) await assertRateLimit('cspReportIp', { kind: 'ip', value: ip });

    const format = cspReportFormat(request.headers.get('content-type'));
    if (!format) return new Response(null, { status: 415 });

    let body: unknown;
    try {
      body = await readBoundedJson(request, MAX_BODY_BYTES);
    } catch (error) {
      // Malformed JSON is the client's fault: 400, not a retryable 500.
      if (error instanceof SyntaxError) {
        throw Errors.validationFailed('Malformed report body.');
      }
      throw error;
    }

    for (const violation of parseCspReport(format, body)) {
      console.warn('[csp-report]', JSON.stringify(violation));
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
