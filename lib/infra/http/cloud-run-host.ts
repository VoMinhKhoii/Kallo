/**
 * Whether a hostname is a Google Cloud Run service URL (`*.run.app`).
 *
 * Production serves on `kallo.fit` through Cloudflare, which rewrites the
 * `Host` header to the run.app hostname before forwarding (see
 * `docs/PROD_DOMAIN_SETUP.md`). So that hostname is what Next sees as the
 * request's own origin — and it is also the one address that skips the edge
 * WAF. Anything that builds a URL for a browser must never hand it out
 * (KALLO-11); this is the test for "would this leak the origin?".
 */
export function isCloudRunHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return host === 'run.app' || host.endsWith('.run.app');
}
