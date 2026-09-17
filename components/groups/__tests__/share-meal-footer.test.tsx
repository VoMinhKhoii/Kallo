import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ShareMealDialogFooter } from '@/components/groups/share-meal/footer';
import { cn } from '@/lib/core/ui/cn';

/** Tailwind classes are whitespace-separated tokens, and several of them are
 *  substrings of each other (`shrink-0` inside `[&_svg]:shrink-0`, `flex-row`
 *  inside `sm:flex-row`), so these assertions compare tokens, never substrings. */
const classes = (el: Element) => el.className.split(/\s+/u);

function renderFooter(label: string) {
  render(
    <ShareMealDialogFooter
      cancelLabel="Huỷ"
      disabled={false}
      label={label}
      onCancel={vi.fn()}
      onShare={vi.fn()}
    />
  );
}

describe('ShareMealDialogFooter', () => {
  it('lays the two buttons in a row at every width', () => {
    renderFooter('Chia sẻ với 5 người · còn 1348 kcal');
    const footer = document.querySelector('[data-slot="dialog-footer"]');

    // The row is the PRIMITIVE's decision and carries no breakpoint; this
    // footer does not restate it. Stacking on a phone was the reported bug.
    expect(classes(footer as Element)).toContain('flex-row');
    expect(classes(footer as Element)).not.toContain('flex-col-reverse');
  });

  it('lets the primary wrap rather than push the row out of the card', () => {
    renderFooter('Share with 5 people · 1348 kcal left');
    const primary = classes(
      screen.getByRole('button', {
        name: 'Share with 5 people · 1348 kcal left',
      })
    );

    // The button base is `whitespace-nowrap shrink-0`. Both have to give, or a
    // long label overflows the dialog instead of growing the button.
    expect(primary).toContain('whitespace-normal');
    expect(primary).toContain('shrink');
    expect(primary).not.toContain('whitespace-nowrap');
    expect(primary).not.toContain('shrink-0');

    // Cancel keeps the base: two syllables should hold their width.
    expect(classes(screen.getByRole('button', { name: 'Huỷ' }))).toContain(
      'whitespace-nowrap'
    );
  });

  it('still lets a dialog opt into stacking by passing its own direction', () => {
    // `nudge-dialog.tsx` does exactly this, so changing the primitive's default
    // must not have silently re-laid-out that dialog.
    const merged = cn(
      'flex flex-row justify-end gap-2',
      'mt-6 flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2'
    ).split(/\s+/u);

    expect(merged).toContain('flex-col-reverse');
    expect(merged).toContain('sm:flex-row');
    expect(merged).not.toContain('flex-row');
  });
});
