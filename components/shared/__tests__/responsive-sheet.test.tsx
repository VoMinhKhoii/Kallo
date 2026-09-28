import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ useIsMobile: vi.fn() }));

vi.mock('@/hooks/ui/use-mobile', () => ({ useIsMobile: mocks.useIsMobile }));

import { ResponsiveSheet } from '../responsive-sheet';
import { ResponsiveSheetHeader } from '../responsive-sheet-header';

function renderSheet({
  isMobile,
  dismissible = true,
  onOpenChange = vi.fn(),
}: {
  isMobile: boolean;
  dismissible?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  mocks.useIsMobile.mockReturnValue(isMobile);
  render(
    <ResponsiveSheet
      dismissible={dismissible}
      onOpenChange={onOpenChange}
      open
      title="Scan Nutrition Label"
    >
      <p>body</p>
    </ResponsiveSheet>
  );
  return { onOpenChange };
}

beforeEach(() => {
  mocks.useIsMobile.mockReset();
});

describe('ResponsiveSheet', () => {
  it('renders a bottom drawer below the mobile breakpoint', () => {
    renderSheet({ isMobile: true });

    const content = document.querySelector('[data-slot="drawer-content"]');
    expect(content).not.toBeNull();
    expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull();
    // The mobile sheet's surface: 22px top corners, capped at 90dvh.
    expect(content?.className).toContain('rounded-t-[22px]');
    expect(content?.className).toContain('max-h-[90dvh]');
  });

  it('renders a centered dialog above the mobile breakpoint', () => {
    renderSheet({ isMobile: false });

    const content = document.querySelector('[data-slot="dialog-content"]');
    expect(content).not.toBeNull();
    expect(document.querySelector('[data-slot="drawer-content"]')).toBeNull();
    expect(content?.className).toContain('rounded-[22px]');
  });

  it.each([
    true,
    false,
  ])('keeps the title available to screen readers (mobile: %s)', (isMobile) => {
    renderSheet({ isMobile });
    expect(screen.getByText('Scan Nutrition Label')).toBeTruthy();
  });

  it.each([
    true,
    false,
  ])('blocks Escape while a save is in flight (mobile: %s)', async (isMobile) => {
    const { onOpenChange } = renderSheet({ isMobile, dismissible: false });

    await userEvent.keyboard('{Escape}');

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it.each([
    true,
    false,
  ])('swallows a close request while a save is in flight (mobile: %s)', (isMobile) => {
    const onOpenChange = vi.fn();
    mocks.useIsMobile.mockReturnValue(isMobile);
    const { rerender } = render(
      <ResponsiveSheet
        dismissible={false}
        onOpenChange={onOpenChange}
        open
        title="Scan Nutrition Label"
      >
        <p>body</p>
      </ResponsiveSheet>
    );

    // Re-rendering with the same props must not leak a close through.
    rerender(
      <ResponsiveSheet
        dismissible={false}
        onOpenChange={onOpenChange}
        open
        title="Scan Nutrition Label"
      >
        <p>body</p>
      </ResponsiveSheet>
    );

    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe('ResponsiveSheetHeader', () => {
  it('centers the title and puts the close button first in the DOM', () => {
    render(
      <ResponsiveSheetHeader
        closeLabel="Cancel"
        onClose={vi.fn()}
        title="Scan Nutrition Label"
      />
    );

    const close = screen.getByRole('button', { name: 'Cancel' });
    const title = screen.getByText('Scan Nutrition Label');
    // Close precedes the title — the Flutter sheet's layout.
    expect(
      close.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    // 17/600 centered title — the shared type scale.
    expect(title.className).toContain('text-[17px]');
    expect(title.className).toContain('font-semibold');
  });

  it('renders the title alone — there is no subtitle slot', () => {
    const { container } = render(
      <ResponsiveSheetHeader
        closeLabel="Cancel"
        onClose={vi.fn()}
        title="Scan Nutrition Label"
      />
    );

    // One <p>: the title. A second would be the orphan line this change removed.
    expect(container.querySelectorAll('p')).toHaveLength(1);
  });

  it('turns the circle into a back chevron for a second level', async () => {
    const onBack = vi.fn();
    const onClose = vi.fn();
    render(
      <ResponsiveSheetHeader
        backLabel="Back"
        closeLabel="Close"
        onBack={onBack}
        onClose={onClose}
        title="Other nutrients"
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('holds a trailing action on the right', () => {
    render(
      <ResponsiveSheetHeader
        closeLabel="Close"
        onClose={vi.fn()}
        title="Barcode"
        trailing={<button type="button">Edit</button>}
      />
    );

    const title = screen.getByText('Barcode');
    const edit = screen.getByRole('button', { name: 'Edit' });
    expect(
      title.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('disables the close button while a save is in flight', async () => {
    const onClose = vi.fn();
    render(
      <ResponsiveSheetHeader
        closeDisabled
        closeLabel="Cancel"
        onClose={onClose}
        title="Scan Nutrition Label"
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
