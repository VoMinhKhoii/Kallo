import { describe, expect, it } from 'vitest';
import { parseAuthBody } from '@/app/api/supabase-proxy/_lib/auth-body';
import {
  type AuthOpClass,
  classifyAuthRequest,
} from '@/app/api/supabase-proxy/_lib/auth-path-policy';

/**
 * A table, not a narrative: every GoTrue path this proxy forwards, and the
 * class it must land in. A misclassification is silent — the request still
 * works, it is just limited by the wrong ceiling — so the only thing that
 * catches it is an exhaustive list someone has to edit deliberately.
 *
 * Cases carry the RAW body bytes and run them through `parseAuthBody`, because
 * half of the bugs this table exists to catch live in the parser: a key GoTrue
 * matches case-insensitively, a form encoding it also accepts, a value too long
 * for a schema that then reported "no target".
 */

interface Case {
  name: string;
  method: string;
  path: string;
  grantType?: string | null;
  /** Raw request body, exactly as it would arrive on the wire. */
  body?: string;
  authorization?: string;
  op: AuthOpClass;
  targetKey?: string | null;
  requiresTarget?: boolean;
}

/** A JWT whose payload is `{"sub":"…"}`; the signature is never checked. */
function bearer(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `Bearer header.${encoded}.signature`;
}

const LONG_LOCAL = 'x'.repeat(300);

const cases: Case[] = [
  // --- email: makes Supabase send mail to a caller-chosen address ----------
  {
    name: 'signup',
    method: 'POST',
    path: 'signup',
    body: '{"email":"Victim@Example.COM","password":"x"}',
    op: 'email',
    targetKey: 'victim@example.com',
    requiresTarget: true,
  },
  {
    name: 'recover',
    method: 'POST',
    path: 'recover',
    body: '{"email":"victim@example.com"}',
    op: 'email',
    targetKey: 'victim@example.com',
  },
  {
    name: 'otp',
    method: 'POST',
    path: 'otp',
    body: '{"email":"victim@example.com"}',
    op: 'email',
    targetKey: 'victim@example.com',
  },
  {
    name: 'magiclink',
    method: 'POST',
    path: 'magiclink',
    body: '{"email":"victim@example.com"}',
    op: 'email',
    targetKey: 'victim@example.com',
  },
  {
    name: 'resend',
    method: 'POST',
    path: 'resend',
    body: '{"email":"victim@example.com","type":"signup"}',
    op: 'email',
    targetKey: 'victim@example.com',
  },
  {
    name: 'email change via PUT /user',
    method: 'PUT',
    path: 'user',
    body: '{"email":"new@example.com"}',
    op: 'email',
    targetKey: 'new@example.com',
  },
  {
    name: 'email change via POST /user',
    method: 'POST',
    path: 'user',
    body: '{"email":"new@example.com"}',
    op: 'email',
    targetKey: 'new@example.com',
  },

  // --- the bypasses. Go binds JSON keys case-insensitively and parses form
  // bodies, so every one of these mails a stranger upstream. ---------------
  {
    name: 'a capitalised Email key still names a recipient',
    method: 'POST',
    path: 'recover',
    body: '{"Email":"Victim@Example.com"}',
    op: 'email',
    targetKey: 'victim@example.com',
  },
  {
    name: 'a shouted EMAIL key still names a recipient',
    method: 'POST',
    path: 'signup',
    body: '{"EMAIL":"victim@example.com","password":"x"}',
    op: 'email',
    targetKey: 'victim@example.com',
  },
  {
    name: 'a form-encoded body still names a recipient',
    method: 'POST',
    path: 'recover',
    body: 'email=victim%40example.com&redirect_to=%2F',
    op: 'email',
    targetKey: 'victim@example.com',
  },
  {
    name: 'plus-addressing collapses onto the mailbox it delivers to',
    method: 'POST',
    path: 'recover',
    body: '{"email":"victim+42@example.com"}',
    op: 'email',
    targetKey: 'victim@example.com',
  },
  {
    name: 'gmail dots collapse too',
    method: 'POST',
    path: 'recover',
    body: '{"email":"v.i.c.t.i.m+x@GMAIL.com"}',
    op: 'email',
    targetKey: 'victim@gmail.com',
  },
  {
    name: 'a 255-character address is keyed, not dropped',
    method: 'POST',
    path: 'recover',
    body: JSON.stringify({ email: `${'a'.repeat(243)}@example.com` }),
    op: 'email',
    targetKey: `${'a'.repeat(243)}@example.com`,
  },
  {
    name: 'an over-long address is capped onto a key, never dropped',
    method: 'POST',
    path: 'recover',
    body: JSON.stringify({ email: `${LONG_LOCAL}@${'d'.repeat(60)}.com` }),
    op: 'email',
    targetKey: `${LONG_LOCAL}@${'d'.repeat(19)}`,
  },
  {
    name: 'a nested object names nobody — and must therefore be refused',
    method: 'POST',
    path: 'recover',
    body: '{"email":{"toLowerCase":"nope"}}',
    op: 'email',
    targetKey: null,
    requiresTarget: true,
  },
  {
    name: 'phone-only OTP keys the phone, in its own namespace',
    method: 'POST',
    path: 'otp',
    body: '{"phone":"+84 90 000 0000"}',
    op: 'email',
    targetKey: 'phone:84900000000',
  },
  {
    name: 'phone-only signup keys the phone',
    method: 'POST',
    path: 'signup',
    body: '{"phone":"+84900000000"}',
    op: 'email',
    targetKey: 'phone:84900000000',
  },
  {
    name: 'a phone change on PUT /user is the SMS spelling of a mail bomb',
    method: 'PUT',
    path: 'user',
    body: '{"phone":"+84900000000"}',
    op: 'email',
    targetKey: 'phone:84900000000',
  },

  // --- reauthenticate: sends a nonce, on GET as well as POST ---------------
  {
    name: 'GET /reauthenticate sends mail and is keyed on the bearer subject',
    method: 'GET',
    path: 'reauthenticate',
    authorization: bearer({ sub: '2b1f0d8e-0000-4000-8000-000000000000' }),
    op: 'email',
    targetKey: 'user:2b1f0d8e-0000-4000-8000-000000000000',
    requiresTarget: false,
  },
  {
    name: 'POST /reauthenticate is the same operation',
    method: 'POST',
    path: 'reauthenticate',
    authorization: bearer({ sub: 'abc' }),
    op: 'email',
    targetKey: 'user:abc',
  },
  {
    name: 'reauthenticate with an unreadable token falls back to IP + global',
    method: 'GET',
    path: 'reauthenticate',
    authorization: 'Bearer not-a-jwt',
    op: 'email',
    targetKey: null,
    requiresTarget: false,
  },

  // --- login: tests a credential ------------------------------------------
  {
    name: 'password grant',
    method: 'POST',
    path: 'token',
    grantType: 'password',
    body: '{"email":"Victim@Example.com","password":"x"}',
    op: 'login',
    targetKey: 'victim@example.com',
    requiresTarget: true,
  },
  {
    name: 'password grant naming nobody must be refused, not forwarded',
    method: 'POST',
    path: 'token',
    grantType: 'password',
    body: '{"password":"x"}',
    op: 'login',
    targetKey: null,
    requiresTarget: true,
  },
  {
    name: 'pkce exchange',
    method: 'POST',
    path: 'token',
    grantType: 'pkce',
    body: '{"auth_code":"abc"}',
    op: 'login',
    targetKey: null,
    requiresTarget: false,
  },
  {
    name: 'id_token grant (Google sign-in)',
    method: 'POST',
    path: 'token',
    grantType: 'id_token',
    body: '{"provider":"google","id_token":"jwt"}',
    op: 'login',
    targetKey: null,
    requiresTarget: false,
  },
  {
    name: 'token with no grant_type falls to login, not the cheap bucket',
    method: 'POST',
    path: 'token',
    grantType: null,
    body: '{}',
    op: 'login',
    targetKey: null,
    requiresTarget: false,
  },
  {
    name: 'verify',
    method: 'POST',
    path: 'verify',
    body: '{"email":"victim@example.com","token":"123456","type":"signup"}',
    op: 'login',
    targetKey: 'victim@example.com',
  },
  {
    name: 'verify by token_hash names nobody and is still forwarded',
    method: 'POST',
    path: 'verify',
    body: '{"token_hash":"pkce_abc","type":"email"}',
    op: 'login',
    targetKey: null,
    requiresTarget: false,
  },
  {
    name: 'MFA challenge',
    method: 'POST',
    path: 'factors/2b1f0d8e-0000-4000-8000-000000000000/challenge',
    op: 'login',
    targetKey: null,
  },
  {
    name: 'MFA verify',
    method: 'POST',
    path: 'factors/2b1f0d8e-0000-4000-8000-000000000000/verify',
    op: 'login',
    targetKey: null,
  },

  // --- refresh -------------------------------------------------------------
  {
    name: 'refresh_token grant',
    method: 'POST',
    path: 'token',
    grantType: 'refresh_token',
    body: '{"refresh_token":"abc"}',
    op: 'refresh',
    targetKey: null,
    requiresTarget: false,
  },

  // --- other ---------------------------------------------------------------
  { name: 'GET /user', method: 'GET', path: 'user', op: 'other' },
  {
    name: 'PUT /user with no email is a profile update',
    method: 'PUT',
    path: 'user',
    body: '{"data":{"display_name":"Khoi"}}',
    op: 'other',
  },
  { name: 'logout', method: 'POST', path: 'logout', op: 'other' },
  { name: 'settings', method: 'GET', path: 'settings', op: 'other' },
  { name: 'authorize', method: 'GET', path: 'authorize', op: 'other' },
  { name: 'callback', method: 'GET', path: 'callback', op: 'other' },
  { name: 'health', method: 'GET', path: 'health', op: 'other' },
  { name: 'MFA enrol', method: 'POST', path: 'factors', op: 'other' },
  {
    name: 'GET /verify (email link)',
    method: 'GET',
    path: 'verify',
    op: 'other',
  },
  {
    name: 'an unknown GoTrue path is limited, just not as something it is not',
    method: 'POST',
    path: 'some/future/endpoint',
    op: 'other',
  },
];

describe('classifyAuthRequest', () => {
  it.each(cases)('classifies $name as $op', (testCase) => {
    const result = classifyAuthRequest({
      method: testCase.method,
      path: testCase.path,
      grantType: testCase.grantType ?? null,
      body: parseAuthBody(
        testCase.body ? new TextEncoder().encode(testCase.body) : undefined
      ),
      authorization: testCase.authorization ?? null,
    });

    expect(result.op).toBe(testCase.op);
    expect(result.targetKey).toBe(testCase.targetKey ?? null);

    if (testCase.requiresTarget !== undefined) {
      expect(result.requiresTarget).toBe(testCase.requiresTarget);
    }
  });

  it('never marks a request that names nobody as forwardable when it mails', () => {
    // The invariant behind `requiresTarget`: for every mail-sending path, a
    // body with no email and no phone must be refusable rather than forwarded
    // on the global budget alone.
    for (const path of ['signup', 'recover', 'otp', 'magiclink', 'resend']) {
      const result = classifyAuthRequest({
        method: 'POST',
        path,
        grantType: null,
        body: {},
        authorization: null,
      });

      expect(result.op).toBe('email');
      expect(result.requiresTarget).toBe(true);
      expect(result.targetKey).toBeNull();
    }
  });
});
