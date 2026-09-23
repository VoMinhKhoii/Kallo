/**
 * @vitest-environment jsdom
 */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Activity } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Radix Select drives its trigger through Pointer Events APIs that jsdom
// does not implement. Without these the listbox never opens.
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const updateSpy = vi.hoisted(() => vi.fn(async () => ({ success: true })));
vi.mock('@/lib/admin/triage/update-feedback-status', () => ({
  updateFeedbackStatus: updateSpy,
}));

import { StatusForm } from '../status-form';

describe('StatusForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateSpy.mockResolvedValue({ success: true });
  });

  it('disables Update until the status actually changes', async () => {
    render(<StatusForm id="fb-1" current="open" />);
    const button = screen.getByRole('button', { name: 'Update' });
    expect(button).toBeDisabled();

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: 'Triaged' }));
    expect(screen.getByRole('button', { name: 'Update' })).toBeEnabled();
  });

  it('submits the selected status and confirms with "Saved"', async () => {
    render(<StatusForm id="fb-1" current="open" />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: 'Resolved' }));
    await userEvent.click(screen.getByRole('button', { name: 'Update' }));

    expect(updateSpy).toHaveBeenCalledWith({ id: 'fb-1', status: 'resolved' });
    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it('shows an alert when the action throws', async () => {
    updateSpy.mockRejectedValueOnce(new Error('nope'));
    render(<StatusForm id="fb-1" current="open" />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: 'Resolved' }));
    await userEvent.click(screen.getByRole('button', { name: 'Update' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Failed to save. Please try again.');
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('clears the saved confirmation when the selection changes again', async () => {
    render(<StatusForm id="fb-1" current="open" />);
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: 'Resolved' }));
    await userEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: "Won't fix" }));
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  // Cache Components hides the page with <Activity> on navigation instead of
  // unmounting it; a "Saved" from an earlier visit must not greet the return.
  it('drops the saved confirmation when the page is hidden and shown again', async () => {
    const page = (mode: 'visible' | 'hidden') => (
      <Activity mode={mode}>
        <StatusForm id="fb-1" current="open" />
      </Activity>
    );
    const view = render(page('visible'));
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: 'Resolved' }));
    await userEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();

    view.rerender(page('hidden'));
    view.rerender(page('visible'));

    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('shows a status changed elsewhere when the page comes back', () => {
    const view = render(<StatusForm id="fb-1" current="open" />);

    view.rerender(<StatusForm id="fb-1" current="resolved" />);

    expect(screen.getByRole('combobox')).toHaveTextContent('Resolved');
    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled();
  });

  // An update still running when the admin leaves settles while the page is
  // hidden; its "Saved" must not greet them when they come back.
  it('drops a result that arrived while the page was hidden', async () => {
    let finish: () => void = () => undefined;
    updateSpy.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ success: true });
        })
    );
    const page = (mode: 'visible' | 'hidden') => (
      <Activity mode={mode}>
        <StatusForm id="fb-1" current="open" />
      </Activity>
    );
    const view = render(page('visible'));
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: 'Resolved' }));
    await userEvent.click(screen.getByRole('button', { name: 'Update' }));

    view.rerender(page('hidden'));
    await act(async () => {
      finish();
    });
    view.rerender(page('visible'));

    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });
});
