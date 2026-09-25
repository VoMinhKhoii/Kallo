import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { setAiProcessingConsent } = vi.hoisted(() => ({
  setAiProcessingConsent: vi.fn(),
}));
vi.mock('@/lib/actions/privacy/ai-consent', () => ({ setAiProcessingConsent }));

import {
  AiConsentProvider,
  useAiConsent,
} from '@/components/privacy/ai-consent-provider';
import type { AiConsentGate } from '@/lib/domain/privacy/consent-gate';

/** Exposes the provider's gate to the test through a ref-like holder. */
function Probe({ onGate }: { onGate: (gate: AiConsentGate) => void }) {
  onGate(useAiConsent().gate);
  return null;
}

function renderProvider(initialConsented: boolean) {
  const holder: { gate: AiConsentGate | null } = { gate: null };
  render(
    <AiConsentProvider initialConsented={initialConsented}>
      <Probe
        onGate={(gate) => {
          holder.gate = gate;
        }}
      />
    </AiConsentProvider>
  );
  return () => {
    if (!holder.gate) throw new Error('provider did not render');
    return holder.gate;
  };
}

beforeEach(() => {
  setAiProcessingConsent.mockReset();
});
afterEach(cleanup);

describe('AiConsentProvider', () => {
  it('lets a consented user straight through without asking', async () => {
    const gate = renderProvider(true);

    await expect(gate().ensure()).resolves.toBe(true);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('asks once, records consent on Continue, and resolves true', async () => {
    setAiProcessingConsent.mockResolvedValue({
      aiProcessingConsentedAt: '2026-09-25T12:10:00.000Z',
    });
    const gate = renderProvider(false);

    let answer: Promise<boolean> = Promise.resolve(false);
    act(() => {
      answer = gate().ensure();
    });
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'continue' }));

    await expect(answer).resolves.toBe(true);
    expect(setAiProcessingConsent).toHaveBeenCalledWith(true);
    // Consent is now on record: the next AI action is not asked again.
    await expect(gate().ensure()).resolves.toBe(true);
  });

  it('sends nothing and resolves false on Not now', async () => {
    const gate = renderProvider(false);

    let answer: Promise<boolean> = Promise.resolve(true);
    act(() => {
      answer = gate().ensure();
    });
    await userEvent.click(
      await screen.findByRole('button', { name: 'notNow' })
    );

    await expect(answer).resolves.toBe(false);
    expect(setAiProcessingConsent).not.toHaveBeenCalled();
  });

  it('re-opens the ask when the server reports consent missing', async () => {
    const gate = renderProvider(true);

    act(() => {
      gate().onRequired();
    });

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
  });
});
