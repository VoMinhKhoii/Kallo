// Signs a browser into the dev evidence account without a password: an admin
// magic link, verified by the app's own /auth/verify route, as an emailed link
// would be. Run directly, it prints the link path for Playwright MCP:
//   node --env-file=.env.local scripts/dev/evidence/sign-in.mjs /en/logging

import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

/**
 * Env a signed-in capture needs, or an error naming what is missing.
 * @param {Record<string, string | undefined>} [env]
 */
export function signInEnv(env = process.env) {
  const missing = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'EVIDENCE_ACCOUNT_EMAIL',
  ].filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing ${missing.join(', ')}. Run with --env-file=.env.local (the dev ` +
        'project); docs/REAL_RUN_EVIDENCE.md sets up the evidence account.'
    );
  }
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    email: env.EVIDENCE_ACCOUNT_EMAIL,
  };
}

const PAGE_SIZE = 1000;

/**
 * Whether the project already has an account with this email. Paged, because
 * the admin API has no lookup by email.
 */
export async function accountExists(listUsers, email) {
  const wanted = email.toLowerCase();
  for (let page = 1; ; page++) {
    const { data, error } = await listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw new Error(`Could not list accounts: ${error.message}`);
    if (data.users.some((user) => user.email?.toLowerCase() === wanted)) {
      return true;
    }
    if (data.users.length < PAGE_SIZE) return false;
  }
}

/**
 * A one-time `/auth/verify` path that signs the evidence account in and then
 * opens `next`. Generating it sends no email.
 * @param {string} next
 * @param {Record<string, string | undefined>} [env]
 */
export async function signInPath(next, env = process.env) {
  const { url, serviceKey, email } = signInEnv(env);
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // A magic link for an unknown email creates that account, so a typo would
  // quietly capture an empty new user.
  const listUsers = (params) => admin.auth.admin.listUsers(params);
  if (!(await accountExists(listUsers, email))) {
    throw new Error(
      `No account ${email} on ${url}. EVIDENCE_ACCOUNT_EMAIL must name an existing dev account.`
    );
  }
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (error)
    throw new Error(`Could not create a sign-in link: ${error.message}`);
  const params = new URLSearchParams({
    token_hash: data.properties.hashed_token,
    type: 'email',
    next,
  });
  return `/auth/verify?${params}`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const next = process.argv[2] ?? '/en/logging';
  process.stdout.write(`${await signInPath(next)}\n`);
}
