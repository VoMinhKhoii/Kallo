import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { MealEditDraft } from '@/lib/domain/meals/meal-edit/meal-edit-draft';
import { MealEditDialog } from '../meal-edit-dialog';

// Record what the dialog asks of its modal: on a phone the drawer slides off
// on a drag before any onOpenChange guard can refuse it, so the lock has to
// reach the modal as `dismissible`.
const seen: { dismissible?: boolean }[] = [];
vi.mock('@/components/shared/responsive-modal', () => ({
  ResponsiveModal: (props: { dismissible?: boolean; children: ReactNode }) => {
    seen.push({ dismissible: props.dismissible });
    return <div role="dialog">{props.children}</div>;
  },
}));

const draft: MealEditDraft = {
  canRemove: true,
  whole: 1,
  dishes: [
    {
      key: '0',
      name: 'Rice',
      unit: 'g',
      grams: 200,
      parts: [
        { id: 'rice', grams: 200, kcal: 260, protein: 5, carbs: 56, fat: 1 },
      ],
    },
  ],
};

describe('MealEditDialog', () => {
  it('locks the modal while a save is in flight, and frees it after', async () => {
    const user = userEvent.setup();
    let settle: () => void = () => {};
    render(
      <MealEditDialog
        open
        onOpenChange={vi.fn()}
        initial={draft}
        commitLabel="save"
        onCommit={() => new Promise<void>((resolve) => (settle = resolve))}
      />
    );
    expect(seen.at(-1)?.dismissible).toBe(true);
    await user.click(screen.getByRole('button', { name: 'save' }));
    expect(seen.at(-1)?.dismissible).toBe(false);
    settle();
    await waitFor(() => expect(seen.at(-1)?.dismissible).toBe(true));
  });
});
