// Canonical public origin for metadata, sitemap, and robots.
//
// This is a hardcoded constant, not an env var, on purpose: those three
// surfaces are statically rendered, and a single container image serves prod
// and non-prod alike — so a runtime `--set-env-vars` cannot change a value that
// was already frozen at `next build`. Prod is the canonical origin even on
// non-prod (which is never indexed). Change this line at the full brand rename.
export const SITE_URL = 'https://kallo.fit';
