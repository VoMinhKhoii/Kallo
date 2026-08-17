/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { replaySpy, toastErrorSpy } = vi.hoisted(() => ({
  replaySpy: vi.fn(async () => undefined as unknown),
  toastErrorSpy: vi.fn(),
}));

vi.mock('@/lib/admin/replay/replay-request', () => ({
  replayRequest: replaySpy,
}));
vi.mock('sonner', () => ({ toast: { error: toastErrorSpy } }));

import { ReplayButton } from '../replay-button';

const ID = '11111111-1111-4111-a111-111111111111';

async function openDialog(name: RegExp) {
  await userEvent.click(screen.getByRole('button', { name }));
}

describe('ReplayButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    replaySpy.mockResolvedValue(undefined);
  });

  it('labels the live and dry-run variants differently', () => {
    const live = render(<ReplayButton requestId={ID} />);
    expect(screen.getByRole('button', { name: 'Replay' })).toBeInTheDocument();
    live.unmount();

    render(<ReplayButton requestId={ID} dryRun />);
    expect(
      screen.getByRole('button', { name: 'Replay (dry-run)' })
    ).toBeInTheDocument();
  });

  it('warns about API quota in the live confirmation', async () => {
    render(<ReplayButton requestId={ID} />);
    await openDialog(/^Replay$/);
    expect(screen.getByText('Replay this request?')).toBeInTheDocument();
    expect(screen.getByText(/consumes API quota/)).toBeInTheDocument();
  });

  it('promises no tokens spent in the dry-run confirmation', async () => {
    render(<ReplayButton requestId={ID} dryRun />);
    await openDialog(/Replay \(dry-run\)/);
    expect(
      screen.getByText('Dry-run replay this request?')
    ).toBeInTheDocument();
    expect(screen.getByText(/No tokens are spent/)).toBeInTheDocument();
  });

  it('calls the action with the dryRun flag on confirm', async () => {
    render(<ReplayButton requestId={ID} dryRun />);
    await openDialog(/Replay \(dry-run\)/);
    await userEvent.click(
      screen.getByRole('button', { name: 'Dry-run replay' })
    );
    expect(replaySpy).toHaveBeenCalledWith(ID, { dryRun: true });
  });

  it('does not call the action when the dialog is cancelled', async () => {
    render(<ReplayButton requestId={ID} />);
    await openDialog(/^Replay$/);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(replaySpy).not.toHaveBeenCalled();
  });

  it('surfaces a rate-limit result as a toast rather than throwing', async () => {
    replaySpy.mockResolvedValueOnce({
      ok: false,
      error: { message: 'Admin replay quota exhausted.' },
    });
    render(<ReplayButton requestId={ID} />);
    await openDialog(/^Replay$/);
    await userEvent.click(screen.getAllByRole('button', { name: 'Replay' })[0]);
    expect(toastErrorSpy).toHaveBeenCalledWith('Admin replay quota exhausted.');
  });

  it('toasts a thrown error message', async () => {
    replaySpy.mockRejectedValueOnce(new Error('boom'));
    render(<ReplayButton requestId={ID} />);
    await openDialog(/^Replay$/);
    await userEvent.click(screen.getAllByRole('button', { name: 'Replay' })[0]);
    expect(toastErrorSpy).toHaveBeenCalledWith('boom');
  });

  // NOTE: the NEXT_REDIRECT branch (rethrow rather than toast) is deliberately
  // not covered here. Exercising it makes React escalate the rethrow out of the
  // transition as an uncaught exception, which vitest reports as a run-level
  // error even when every assertion passes.
  it('toasts a generic message for a non-Error rejection', async () => {
    replaySpy.mockRejectedValueOnce('just a string');
    render(<ReplayButton requestId={ID} />);
    await openDialog(/^Replay$/);
    await userEvent.click(screen.getAllByRole('button', { name: 'Replay' })[0]);
    expect(toastErrorSpy).toHaveBeenCalledWith('Replay failed');
  });
});
