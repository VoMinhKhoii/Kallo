import { describe, expect, it } from 'vitest';
import { isCloudRunHost } from '@/lib/infra/http/cloud-run-host';

describe('isCloudRunHost', () => {
  it.each([
    'kallo-prod-abc123-as.a.run.app',
    'KALLO-PROD-ABC123-AS.A.RUN.APP',
    'kallo-prod-abc123-as.a.run.app.',
    'run.app',
  ])('flags %s', (host) => {
    expect(isCloudRunHost(host)).toBe(true);
  });

  it.each([
    'kallo.fit',
    'localhost',
    'accounts.google.com',
    'project.supabase.co',
    'notrun.app.example.com',
    'evilrun.app',
  ])('does not flag %s', (host) => {
    expect(isCloudRunHost(host)).toBe(false);
  });
});
