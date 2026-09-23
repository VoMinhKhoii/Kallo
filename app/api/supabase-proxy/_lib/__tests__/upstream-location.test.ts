import { describe, expect, it } from 'vitest';
import { rewriteUpstreamLocation } from '@/app/api/supabase-proxy/_lib/upstream-location';

const upstream = new URL('https://project.supabase.co/auth/v1/authorize');
const rewrite = (location: string) =>
  rewriteUpstreamLocation(location, upstream);

describe('rewriteUpstreamLocation', () => {
  it.each([
    // The OAuth hop to the identity provider must survive byte for byte.
    'https://accounts.google.com/o/oauth2/v2/auth?client_id=x&redirect_uri=https%3A%2F%2Fproject.supabase.co%2Fauth%2Fv1%2Fcallback&state=abc',
    // The app's own callback (redirect_to) and a dev target.
    'https://kallo.fit/auth/callback?code=abc',
    'http://localhost:3000/auth/callback?code=abc',
    // The Flutter app's custom-scheme deep link.
    'fit.kallo.app://login-callback?code=abc',
  ])('passes %s through untouched', (location) => {
    expect(rewrite(location)).toBe(location);
  });

  it('moves an absolute Supabase auth target onto the proxy path', () => {
    expect(
      rewrite('https://project.supabase.co/auth/v1/verify?token=t&type=signup')
    ).toBe('/api/supabase-proxy/auth/v1/verify?token=t&type=signup');
  });

  it('resolves a relative reference against Supabase, then rewrites it', () => {
    expect(rewrite('/auth/v1/callback?error=x#frag')).toBe(
      '/api/supabase-proxy/auth/v1/callback?error=x#frag'
    );
    expect(rewrite('callback')).toBe('/api/supabase-proxy/auth/v1/callback');
  });

  it.each([
    'https://project.supabase.co/rest/v1/user_profiles',
    'https://project.supabase.co/storage/v1/object/x',
    'http://project.supabase.co/rest/v1/user_profiles',
    'https://PROJECT.supabase.co:8443/rest/v1/user_profiles',
    '/rest/v1/user_profiles',
    '../../rest/v1/user_profiles',
  ])('drops a Supabase target outside auth/v1: %s', (location) => {
    expect(rewrite(location)).toBeNull();
  });

  it.each([
    'https://kallo-prod-abc123-as.a.run.app/en/logging',
    'https://KALLO-PROD-ABC123-AS.A.RUN.APP/',
    'https://kallo-prod-abc123-as.a.run.app./',
    '//kallo-prod-abc123-as.a.run.app/api/supabase-proxy/auth/v1/token',
    'http://run.app/',
  ])('drops a Cloud Run origin: %s', (location) => {
    expect(rewrite(location)).toBeNull();
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'http://[::1',
  ])('drops a script-bearing or unparseable target: %s', (location) => {
    expect(rewrite(location)).toBeNull();
  });
});
