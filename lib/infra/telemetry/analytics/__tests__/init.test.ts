import type { CaptureResult } from 'posthog-js';
import { describe, expect, it } from 'vitest';
import { sanitizeCapture } from '../init';

describe('sanitizeCapture', () => {
  it('reduces every URL-shaped property, including person $set props', () => {
    const event = {
      uuid: 'u',
      event: '$pageview',
      properties: {
        $current_url: 'https://kallo.fit/en/circle/s-1?x=1',
        $pathname: '/en/circle/s-1',
        $referrer: 'https://mail.example.com/inbox/123',
        method: 'ai',
      },
      $set_once: {
        $initial_current_url: 'https://kallo.fit/vi/invite/abc?ref=z',
      },
    } as unknown as CaptureResult;

    const out = sanitizeCapture(event);

    expect(out?.properties).toMatchObject({
      $current_url: 'https://kallo.fit/en/circle/:param',
      $pathname: '/en/circle/:param',
      $referrer: 'https://mail.example.com/:param/:param',
      method: 'ai',
    });
    expect(out?.$set_once).toEqual({
      $initial_current_url: 'https://kallo.fit/vi/invite/:param',
    });
  });

  it('reduces PostHog-derived keys too, e.g. $session_entry_*', () => {
    const event = {
      uuid: 'u',
      event: '$pageview',
      properties: {
        $session_entry_url: 'https://kallo.fit/vi/invite/abc?ref=z',
        $session_entry_referrer: 'https://mail.example.com/inbox/1',
        $session_entry_pathname: '/vi/invite/abc',
        $session_entry_utm_source: 'newsletter',
      },
    } as unknown as CaptureResult;

    expect(sanitizeCapture(event)?.properties).toEqual({
      $session_entry_url: 'https://kallo.fit/vi/invite/:param',
      $session_entry_referrer: 'https://mail.example.com/:param/:param',
      $session_entry_pathname: '/vi/invite/:param',
      $session_entry_utm_source: 'newsletter',
    });
  });

  it('passes a dropped (null) event through', () => {
    expect(sanitizeCapture(null)).toBeNull();
  });
});
