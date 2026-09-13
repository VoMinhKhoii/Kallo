import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PartialDayNotice } from '../partial-day-notice';

function renderNotice(overrides: { onMarkComplete?: () => void } = {}) {
  const onMarkComplete = overrides.onMarkComplete ?? vi.fn();
  render(
    <PartialDayNotice
      calories={400}
      isMarkingComplete={false}
      onMarkComplete={onMarkComplete}
      target={2000}
    />
  );
  return { onMarkComplete };
}

describe('PartialDayNotice', () => {
  it('renders an informational status callout with title and body', () => {
    renderNotice();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('does not mark the day on the first click — the dialog is the only guard', async () => {
    const user = userEvent.setup();
    const { onMarkComplete } = renderNotice();

    await user.click(screen.getByRole('button', { name: /markComplete/ }));

    expect(onMarkComplete).not.toHaveBeenCalled();
    expect(await screen.findByText('confirmTitle')).toBeInTheDocument();
  });

  it('marks the day once the confirmation is accepted', async () => {
    const user = userEvent.setup();
    const { onMarkComplete } = renderNotice();

    await user.click(screen.getByRole('button', { name: /markComplete/ }));
    await user.click(
      await screen.findByRole('button', { name: 'confirmAccept' })
    );

    await waitFor(() => expect(onMarkComplete).toHaveBeenCalledTimes(1));
  });

  it('leaves the day alone when the confirmation is dismissed', async () => {
    const user = userEvent.setup();
    const { onMarkComplete } = renderNotice();

    await user.click(screen.getByRole('button', { name: /markComplete/ }));
    await user.click(
      await screen.findByRole('button', { name: 'confirmCancel' })
    );

    await waitFor(() =>
      expect(screen.queryByText('confirmTitle')).not.toBeInTheDocument()
    );
    expect(onMarkComplete).not.toHaveBeenCalled();
  });

  it('disables the trigger while a mark is in flight', () => {
    render(
      <PartialDayNotice
        calories={400}
        isMarkingComplete
        onMarkComplete={vi.fn()}
        target={2000}
      />
    );

    expect(screen.getByRole('button', { name: /markComplete/ })).toBeDisabled();
  });
});
