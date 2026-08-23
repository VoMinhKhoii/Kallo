import { SITE_URL } from '@/lib/seo/site';

/**
 * RFC 9728 protected-resource metadata for `/api/v1`.
 *
 * What this says is deliberately narrow, because it is the honest shape of the
 * thing: Kallo's API is protected by Supabase-issued user JWTs presented in the
 * Authorization header, and that is all.
 *
 * `scopes_supported` is ABSENT on purpose. RFC 9728 recommends it, but Supabase
 * access tokens carry no scopes — a bearer holds the user's full authority —
 * and publishing a scope list a client could request and we would not enforce
 * would be worse than publishing nothing. It goes in when scoped tokens exist.
 *
 * There is likewise no `/.well-known/oauth-authorization-server` here: Kallo is
 * not an authorization server. The issuer named below is, and it publishes its
 * own metadata at `<issuer>/.well-known/openid-configuration`.
 */
export const dynamic = 'force-static';

/**
 * The Supabase Auth issuer. Read from the public env var the browser client
 * already uses, so a project change cannot leave this pointing at the old one.
 */
function authorizationServer(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return url ? `${url.replace(/\/+$/, '')}/auth/v1` : null;
}

export function GET(): Response {
  const issuer = authorizationServer();

  const metadata = {
    resource: `${SITE_URL}/api/v1`,
    resource_name: 'Kallo API',
    ...(issuer ? { authorization_servers: [issuer] } : {}),
    bearer_methods_supported: ['header'],
    resource_documentation: `${SITE_URL}/en/docs/developers/api`,
    resource_policy_uri: `${SITE_URL}/en/docs/legal/privacy`,
    resource_tos_uri: `${SITE_URL}/en/docs/legal/terms`,
  };

  return new Response(JSON.stringify(metadata, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
