import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DocsSearch } from '@/components/docs/docs-search';

// jsdom has neither, and cmdk needs both once the palette is mounted.
beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  Element.prototype.scrollIntoView = vi.fn();
});

describe('DocsSearch', () => {
  it('puts no heading in the page until the palette is used', () => {
    // `CommandDialog` renders its sr-only title as an `h2` next to the dialog,
    // so a mounted-but-closed palette put one ahead of every docs page's `h1`.
    render(<DocsSearch entries={[]} />);

    expect(screen.queryAllByRole('heading', { hidden: true })).toHaveLength(0);
  });

  it('opens on Ctrl+K and names the dialog', () => {
    render(<DocsSearch entries={[]} />);

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('label', { selector: 'h2' })).toBeInTheDocument();
  });
});
