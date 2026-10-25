import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type TurnstileState, useTurnstile } from '@/hooks/auth/use-turnstile';
import type { TurnstileRenderOptions } from '@/lib/infra/security/turnstile-script';
import { resetTurnstileLoader } from '@/lib/infra/security/turnstile-script';

let options: TurnstileRenderOptions | undefined;
const api = {
  render: vi.fn((_el: HTMLElement, opts: TurnstileRenderOptions) => {
    options = opts;
    return 'widget-1';
  }),
  reset: vi.fn(),
  remove: vi.fn(),
};

let state: TurnstileState;

function Host({ siteKey }: { siteKey: string | null }) {
  state = useTurnstile(siteKey, 'vi');
  return <div ref={state.containerRef} />;
}

async function mount(siteKey: string | null) {
  const view = render(<Host siteKey={siteKey} />);
  // Let the loader's promise resolve and the widget render.
  await act(async () => {});
  return view;
}

beforeEach(() => {
  vi.clearAllMocks();
  options = undefined;
  window.turnstile = api;
});

afterEach(() => {
  delete window.turnstile;
  resetTurnstileLoader();
});

describe('useTurnstile', () => {
  it('renders an invisible-unless-needed widget and holds its token', async () => {
    await mount('site-key');

    expect(api.render).toHaveBeenCalledTimes(1);
    expect(options).toMatchObject({
      sitekey: 'site-key',
      action: 'auth-email',
      appearance: 'interaction-only',
      language: 'vi',
    });
    expect(state.required).toBe(true);
    expect(state.token).toBeNull();

    act(() => options?.callback?.('tok-1'));
    expect(state.token).toBe('tok-1');
  });

  it('spends the token on reset and asks the widget for a fresh one', async () => {
    await mount('site-key');
    act(() => options?.callback?.('tok-1'));

    act(() => state.reset());

    expect(state.token).toBeNull();
    expect(api.reset).toHaveBeenCalledWith('widget-1');
  });

  it('drops an expired token and reports a failed check', async () => {
    await mount('site-key');
    act(() => options?.callback?.('tok-1'));

    act(() => options?.['expired-callback']?.());
    expect(state.token).toBeNull();

    act(() => options?.['error-callback']?.('300010'));
    expect(state.failed).toBe(true);
  });

  it('tracks when Cloudflare shows its checkbox', async () => {
    await mount('site-key');

    act(() => options?.['before-interactive-callback']?.());
    expect(state.interactive).toBe(true);
    act(() => options?.['after-interactive-callback']?.());
    expect(state.interactive).toBe(false);
  });

  it('does nothing without a site key (local dev)', async () => {
    await mount(null);

    expect(api.render).not.toHaveBeenCalled();
    expect(state.required).toBe(false);
  });

  it('removes the widget on unmount', async () => {
    const view = await mount('site-key');

    view.unmount();

    expect(api.remove).toHaveBeenCalledWith('widget-1');
  });
});
