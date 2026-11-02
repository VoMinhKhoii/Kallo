import * as Sentry from '@sentry/nextjs';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sharedSentryOptions } from '@/lib/infra/telemetry/monitoring/sentry-options';

describe('database exception privacy', () => {
  afterEach(async () => {
    await Sentry.close();
    vi.unstubAllEnvs();
  });

  it('scrubs real Drizzle errors and quoted driver causes before transport', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://dummy@sentry.invalid/1');
    const sent: string[] = [];
    Sentry.init({
      ...sharedSentryOptions('test'),
      tracesSampleRate: 0,
      transport: () => ({
        send: async (envelope: unknown) => {
          sent.push(JSON.stringify(envelope));
          return { statusCode: 200 };
        },
        flush: async () => true,
      }),
    });
    const privateValues = Array.from({ length: 4 }, () => crypto.randomUUID());
    privateValues[0] += `\n    at ${crypto.randomUUID()} (/private/${crypto.randomUUID()}.ts:1:1)`;
    const cause = Object.assign(
      new Error(`invalid input: ${privateValues[0]}`),
      {
        code: '22P02',
        detail: `Failing row contains ${privateValues[2]}`,
      }
    );
    const error = new DrizzleQueryError(
      'insert into meals values ($1, $2, $3, $4)',
      privateValues,
      cause
    );
    Sentry.captureException(error);
    await Sentry.flush(3000);
    expect(sent).toHaveLength(1);
    const payload = sent.join('');
    expect(payload).toContain('insert into meals');
    for (const value of privateValues) expect(payload).not.toContain(value);
    const events = sent.flatMap((entry) =>
      JSON.parse(entry)[1].map((item: unknown[]) => item[1])
    );
    for (const event of events) {
      for (const exception of event.exception?.values ?? []) {
        expect(exception.value).not.toContain('params:');
      }
    }
  });
});
