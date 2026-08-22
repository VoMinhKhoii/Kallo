/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
});
