// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '@/components/shared/confirm-dialog/confirm-dialog';

function open(props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = props.onConfirm ?? vi.fn();
  render(
    <ConfirmDialog
      trigger={<button type="button">Open</button>}
      title="Discard this unsaved meal?"
      description="The analysis disappears."
      confirmLabel="Discard"
      cancelLabel="Cancel"
      {...props}
      onConfirm={onConfirm}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  return onConfirm;
}

describe('ConfirmDialog', () => {
  it('a destructive confirm is the one filled button, in error red', () => {
    open({ tone: 'destructive' });
    // The red must REPLACE the primary fill, not sit beside it: with both
    // classes present, CSS order painted the button umber in the browser.
    const action = screen.getByRole('button', { name: 'Discard' });
    expect(action.className).toContain('bg-kallo-error');
    expect(action.className).not.toContain('bg-primary');
    // Cancel is bare until hovered, and only our hover wash applies.
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(cancel.className).not.toMatch(/(^|\s)bg-/);
    const cancelClasses = cancel.className.split(/\s+/);
    expect(cancelClasses).toContain('hover:bg-kallo-hover');
    expect(cancelClasses).toContain('dark:hover:bg-kallo-hover');
    expect(cancelClasses).not.toContain('hover:bg-accent');
    expect(cancelClasses).not.toContain('dark:hover:bg-accent/50');
  });

  it('a default confirm keeps the umber primary, not red', () => {
    open();
    expect(
      screen.getByRole('button', { name: 'Discard' }).className
    ).not.toContain('bg-kallo-error');
  });

  it('runs onConfirm and closes', () => {
    const onConfirm = open();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('stays open when the handler prevents default — a mutation in flight', () => {
    open({ onConfirm: (event) => event.preventDefault() });
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
  });

  it('disables the action while pending', () => {
    open({ pending: true });
    expect(
      screen.getByRole('button', { name: 'Discard' }).hasAttribute('disabled')
    ).toBe(true);
  });
});
