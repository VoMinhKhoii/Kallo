/**
 * Integration test for the `/` relog flow as the user experiences it.
 *
 * Everything below the network boundary is REAL — MealInput's uncontrolled
 * textarea, parseSlashToken, useSlashPicker, useRelogCandidates (through
 * TanStack Query), useStagedEntries, RelogPickerPopup and StagedList. Only the
 * two server actions are stubbed. Unit tests prove the pieces; this proves they
 * are wired together.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InputMode } from '@/components/logging/input/cheat-mode-picker';
import {
  MealInput,
  type MealInputHandle,
} from '@/components/logging/input/meal-input';
import { RelogPickerPopup } from '@/components/logging/input/relog/relog-picker-popup';
import { StagedList } from '@/components/logging/input/relog/staged-list';
import { useRelogComposer } from '@/hooks/meals/relog/use-relog-composer';
import type {
  RelogCandidatesResponse,
  RelogDishCandidate,
  RelogMealCandidate,
} from '@/lib/logging/relog/relog';

// The global next-intl stub echoes keys, so "{kcal} kcal" would never render a
// number. Use the REAL Vietnamese messages here — the totals are the point of
// several assertions below, and this also catches a missing/renamed key.
vi.mock('next-intl', async () => {
  const messages = (await import('@/messages/vi.json')).default as Record<
    string,
    unknown
  >;
  const lookup = (path: string) =>
    path
      .split('.')
      .reduce<unknown>(
        (node, part) => (node as Record<string, unknown>)?.[part],
        messages
      );
  return {
    useTranslations: (namespace: string) => {
      const t = (key: string, params?: Record<string, unknown>) => {
        const raw = lookup(`${namespace}.${key}`);
        if (typeof raw !== 'string') return `${namespace}.${key}`;
        return params
          ? Object.entries(params).reduce(
              (str, [k, v]) => str.replaceAll(`{${k}}`, String(v)),
              raw
            )
          : raw;
      };
      t.rich = t;
      t.raw = t;
      return t;
    },
    useLocale: () => 'vi',
    useMessages: () => messages,
  };
});

const loadCandidates = vi.hoisted(() => vi.fn());
const relogItems = vi.hoisted(() => vi.fn());

vi.mock('@/lib/actions/meals/relog/load-candidates', () => ({
  loadRelogCandidatesAction: loadCandidates,
}));
vi.mock('@/lib/actions/meals/relog/relog-items', () => ({
  relogMealItemsAction: relogItems,
}));

const dish = (name: string, kcal: number, order = 0): RelogDishCandidate => ({
  kind: 'dish',
  sourceMealId: '11111111-1111-4111-8111-111111111111',
  mealItemOrder: order,
  name,
  ingredientCount: 2,
  occurrenceCount: 3,
  lastLoggedAt: '2026-07-29T00:00:00.000Z',
  totalGrams: 400,
  caloriesKcal: kcal,
  proteinG: 20,
  carbohydrateG: 60,
  fatG: 10,
});

const meal = (name: string, kcal: number): RelogMealCandidate => ({
  kind: 'meal',
  sourceMealId: '22222222-2222-4222-8222-222222222222',
  name,
  dishCount: 2,
  occurrenceCount: 1,
  lastLoggedAt: '2026-07-28T00:00:00.000Z',
  totalGrams: 600,
  caloriesKcal: kcal,
  proteinG: 25,
  carbohydrateG: 70,
  fatG: 12,
});

const RESULTS: RelogCandidatesResponse = {
  dishes: [dish('Phở bò', 420), dish('Phở gà', 380, 1)],
  meals: [meal('phở bò với trà đá', 490)],
};

/** The composer as the feed wires it — MealInput plus the two relog slots. */
function Harness({
  onSubmitted,
  mode = 'normal',
}: {
  onSubmitted?: () => void;
  mode?: InputMode;
} = {}) {
  const inputRef = useRef<MealInputHandle>(null);
  const relog = useRelogComposer({
    userId: 'user-1',
    selectedDate: '2026-07-30',
    loggingMode: mode,
    inputRef,
    scrollToBottom: () => {},
  });
  const {
    relogPicker,
    relogCandidates,
    relogStaged,
    hasStagedRelog,
    isRelogEnabled,
  } = relog;

  return (
    <MealInput
      ref={inputRef}
      mode={mode}
      onSubmit={() => {
        relog.handleRelogSubmit();
        onSubmitted?.();
      }}
      hasExternalContent={hasStagedRelog}
      onTextareaKeyDown={relogPicker.handleKeyDown}
      onTextareaSync={relogPicker.syncFromTextarea}
      isPopupOpen={relogPicker.isOpen}
      popupListboxId="relog-listbox"
      popupActiveDescendantId={`relog-listbox-${relogPicker.highlighted}`}
      aboveSlot={
        // Mirrors FeedComposer's gate exactly.
        isRelogEnabled ? (
          <StagedList
            entries={relogStaged.entries}
            totals={relogStaged.totals}
            showTextHint={hasStagedRelog}
            onRemove={relogStaged.remove}
          />
        ) : null
      }
      popupSlot={
        relogPicker.isOpen ? (
          <RelogPickerPopup
            listboxId="relog-listbox"
            query={relogPicker.query}
            candidates={relogCandidates}
            highlighted={relogPicker.highlighted}
            onHighlight={relogPicker.setHighlighted}
            onSelect={relogPicker.select}
          />
        ) : null
      }
    />
  );
}

function renderHarness(onSubmitted?: () => void, mode: InputMode = 'normal') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <Harness onSubmitted={onSubmitted} mode={mode} />
    </QueryClientProvider>
  );
  const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
  return { ...view, textarea };
}

/** Type into the uncontrolled textarea the way a user would. */
function type(textarea: HTMLTextAreaElement, value: string) {
  fireEvent.change(textarea, { target: { value } });
  fireEvent.keyUp(textarea, { key: 'a' });
}

const key = (textarea: HTMLTextAreaElement, k: string) =>
  fireEvent.keyDown(textarea, { key: k });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  loadCandidates.mockResolvedValue(RESULTS);
  relogItems.mockResolvedValue({ mealId: 'new-meal', meal: {} });
});

describe('relog `/` flow', () => {
  it('opens the picker on `/` and lists dishes then meals', async () => {
    const { textarea } = renderHarness();
    expect(screen.queryByRole('listbox')).toBeNull();

    type(textarea, '/');

    await waitFor(() => expect(screen.getByRole('listbox')).toBeVisible());
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining('Phở bò'),
      expect.stringContaining('Phở gà'),
      expect.stringContaining('phở bò với trà đá'),
    ]);
    // Dishes group renders before meals.
    expect(screen.getByText('Món')).toBeVisible();
    expect(screen.getByText('Bữa ăn')).toBeVisible();
  });

  it('passes the typed query through to the search', async () => {
    const { textarea } = renderHarness();
    type(textarea, '/pho bo');
    await waitFor(() =>
      expect(loadCandidates).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'pho bo' })
      )
    );
  });

  it('never opens on a mid-word slash', async () => {
    const { textarea } = renderHarness();
    type(textarea, '1/2 quả táo');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(loadCandidates).not.toHaveBeenCalled();
  });

  it('stages a dish on Enter, strips the token, and shows the total', async () => {
    const { textarea } = renderHarness();
    type(textarea, 'xem /pho');
    await screen.findAllByRole('option');

    key(textarea, 'Enter');

    // Token spliced out; the rest of the sentence survives.
    await waitFor(() => expect(textarea.value).toBe('xem '));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByText('Phở bò')).toBeVisible();
    // With a single staged dish the row kcal and the total are both 420.
    expect(screen.getAllByText('420 kcal')).toHaveLength(2);
  });

  it('moves the highlight with the arrows before selecting', async () => {
    const { textarea } = renderHarness();
    type(textarea, '/');
    await screen.findAllByRole('option');

    key(textarea, 'ArrowDown');
    await waitFor(() =>
      expect(textarea).toHaveAttribute(
        'aria-activedescendant',
        'relog-listbox-1'
      )
    );
    key(textarea, 'Enter');

    await waitFor(() => expect(screen.getByText('Phở gà')).toBeVisible());
  });

  it('crosses from the last dish into the first meal without a dead stop', async () => {
    const { textarea } = renderHarness();
    type(textarea, '/');
    await screen.findAllByRole('option');

    key(textarea, 'ArrowDown');
    key(textarea, 'ArrowDown'); // index 2 = the meals group's first row
    key(textarea, 'Enter');

    await waitFor(() =>
      expect(screen.getByText('phở bò với trà đá')).toBeVisible()
    );
  });

  it('sums the staged totals across several picks', async () => {
    const { textarea } = renderHarness();
    type(textarea, '/');
    await screen.findAllByRole('option');
    key(textarea, 'Enter');
    await waitFor(() => expect(screen.getByText('Phở bò')).toBeVisible());

    type(textarea, '/');
    await screen.findAllByRole('option');
    key(textarea, 'ArrowDown');
    key(textarea, 'Enter');

    // 420 + 380
    await waitFor(() => expect(screen.getByText('800 kcal')).toBeVisible());
  });

  it('removes a staged row and updates the total', async () => {
    const { textarea } = renderHarness();
    type(textarea, '/');
    await screen.findAllByRole('option');
    key(textarea, 'Enter');
    await waitFor(() => expect(screen.getByText('Phở bò')).toBeVisible());

    fireEvent.click(screen.getByRole('button', { name: 'Bỏ Phở bò' }));

    await waitFor(() => expect(screen.queryByText('Phở bò')).toBeNull());
  });

  it('closes on Escape and does not re-open while typing the same token', async () => {
    const { textarea } = renderHarness();
    type(textarea, '/pho');
    await screen.findAllByRole('option');

    key(textarea, 'Escape');
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());

    type(textarea, '/phob');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });
    expect(screen.queryByRole('listbox')).toBeNull();
    // The text the user typed is untouched by the dismissal.
    expect(textarea.value).toBe('/phob');
  });

  it('submits the staged references, not the typed text', async () => {
    const onSubmitted = vi.fn();
    const { textarea } = renderHarness(onSubmitted);
    type(textarea, '/');
    await screen.findAllByRole('option');
    key(textarea, 'Enter');
    await waitFor(() => expect(screen.getByText('Phở bò')).toBeVisible());

    // Free text alongside the staged pick.
    type(textarea, 'thêm trà đá');
    key(textarea, 'Enter');

    await waitFor(() => expect(relogItems).toHaveBeenCalled());
    expect(relogItems.mock.calls[0][0].items).toEqual([
      {
        kind: 'dish',
        sourceMealId: '11111111-1111-4111-8111-111111111111',
        mealItemOrder: 0,
      },
    ]);
    // The typed text is preserved for a second, deliberate submit.
    expect(textarea.value).toBe('thêm trà đá');
  });

  it('enables submit from a staged pick alone, with the composer empty', async () => {
    const { textarea } = renderHarness();
    const submit = screen.getByRole('button', { name: 'Phân tích' });
    expect(submit).toBeDisabled();

    type(textarea, '/');
    await screen.findAllByRole('option');
    key(textarea, 'Enter');

    await waitFor(() => expect(submit).toBeEnabled());
  });

  it('restores staged picks from the draft after a remount', async () => {
    const first = renderHarness();
    type(first.textarea, '/');
    await screen.findAllByRole('option');
    key(first.textarea, 'Enter');
    await waitFor(() => expect(screen.getByText('Phở bò')).toBeVisible());
    // The staged draft is debounced; let it flush.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 600));
    });
    first.unmount();

    renderHarness();
    expect(await screen.findByText('Phở bò')).toBeVisible();
  });

  it('keeps a staged draft out of cheat mode entirely', async () => {
    // Relog is normal-mode only. A draft staged in normal mode must not leak
    // into cheat mode, where submitting would relog dishes instead of running
    // the cheat estimate — and the staged list would sit above a composer that
    // has nothing to do with it. The draft survives; it is only hidden.
    const first = renderHarness();
    type(first.textarea, '/');
    await screen.findAllByRole('option');
    key(first.textarea, 'Enter');
    await waitFor(() => expect(screen.getByText('Phở bò')).toBeVisible());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 600));
    });
    first.unmount();

    // Same draft, cheat mode.
    const cheat = renderHarness(undefined, 'cheat');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.queryByText('Phở bò')).toBeNull();
    // ...and submit must not be armed by the hidden draft.
    expect(screen.getByRole('button', { name: 'Phân tích' })).toBeDisabled();
    cheat.unmount();

    // Back in normal mode the draft is still there.
    renderHarness();
    expect(await screen.findByText('Phở bò')).toBeVisible();
  });

  it('does not open the picker in cheat mode', async () => {
    const { textarea } = renderHarness(undefined, 'cheat');
    type(textarea, '/');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(loadCandidates).not.toHaveBeenCalled();
  });

  it('does not send an ARIA combobox role while the picker is closed', async () => {
    const { textarea } = renderHarness();
    expect(textarea).not.toHaveAttribute('role');
    expect(textarea).not.toHaveAttribute('aria-expanded');

    type(textarea, '/');
    await screen.findAllByRole('option');
    expect(textarea).toHaveAttribute('role', 'combobox');
    expect(textarea).toHaveAttribute('aria-expanded', 'true');
  });
});
