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
const stageRelog = vi.hoisted(() => vi.fn());

vi.mock('@/lib/actions/meals/relog/load-candidates', () => ({
  loadRelogCandidatesAction: loadCandidates,
}));
vi.mock('@/lib/actions/meals/relog/stage-relog-analysis', () => ({
  stageRelogAnalysisAction: stageRelog,
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
  onAiSubmit,
  mode = 'normal',
}: {
  onSubmitted?: () => void;
  onAiSubmit?: (override?: {
    message: string;
    refs?: unknown[];
  }) => boolean | undefined;
  mode?: InputMode;
} = {}) {
  const inputRef = useRef<MealInputHandle>(null);
  const relog = useRelogComposer({
    selectedDate: '2026-07-30',
    loggingMode: mode,
    inputRef,
    scrollToBottom: () => {},
    setMessages: () => {},
    handleSubmit: (override) => {
      const started = onAiSubmit?.(override);
      // The real useFeedSubmit resolves to whether the analysis started; let a
      // test force `false` by returning it from the spy (default true).
      return Promise.resolve(started === undefined ? true : Boolean(started));
    },
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
        void relog.handleNormalSubmit();
        onSubmitted?.();
      }}
      hasExternalContent={hasStagedRelog}
      onTextareaKeyDown={relogPicker.handleKeyDown}
      onTextareaSync={relogPicker.syncFromTextarea}
      isPopupOpen={relogPicker.isOpen}
      mentionSegments={relog.mentionSegments}
      popupListboxId="relog-listbox"
      popupActiveDescendantId={`relog-listbox-${relogPicker.highlighted}`}
      aboveSlot={
        // Mirrors FeedComposer's gate exactly.
        isRelogEnabled ? (
          <StagedList
            entries={relogStaged.entries}
            totals={relogStaged.totals}
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

function renderHarness(
  onSubmitted?: () => void,
  mode: InputMode = 'normal',
  onAiSubmit?: (override?: {
    message: string;
    refs?: unknown[];
  }) => boolean | undefined
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <Harness onSubmitted={onSubmitted} onAiSubmit={onAiSubmit} mode={mode} />
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

/** A picked dish now appears TWICE — as tinted text in the input and as a
 *  staged row — so queries scope to the row's unique remove button. */
const stagedRow = (name: string) =>
  screen.queryByRole('button', { name: `Bỏ ${name}` });
/** The blue runs the mirror paints behind the textarea. */
const mentionText = () =>
  Array.from(document.querySelectorAll('.text-nham-mention')).map(
    (el) => el.textContent
  );

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  loadCandidates.mockResolvedValue(RESULTS);
  stageRelog.mockResolvedValue({
    analysisId: 'analysis-1',
    parsedMeal: { mealName: 'Phở bò', items: [], totalMacros: {} },
    rawInput: 'Phở bò',
    loggedAt: '2026-07-30T08:00:00.000Z',
  });
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

  it('writes the pick into the input as tinted text and stages it', async () => {
    const { textarea } = renderHarness();
    type(textarea, 'xem /pho');
    await screen.findAllByRole('option');

    key(textarea, 'Enter');

    // The token is replaced by the dish name in place — the pick is visible
    // prose in the composer, not something that vanished into a list.
    await waitFor(() => expect(textarea.value).toBe('xem Phở bò '));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(mentionText()).toEqual(['Phở bò']);
    expect(stagedRow('Phở bò')).toBeVisible();
    // With a single staged dish the row kcal and the total are both 420.
    expect(screen.getAllByText('420 kcal')).toHaveLength(2);
  });

  it('hands the glyphs to the mirror only while a mention exists', async () => {
    const { textarea } = renderHarness();
    // Plain typing keeps the textarea's own ink.
    type(textarea, 'phở bò');
    expect(textarea.className).toContain('text-nham-text');
    expect(textarea.className).not.toContain('text-transparent');

    type(textarea, '/');
    await screen.findAllByRole('option');
    key(textarea, 'Enter');

    await waitFor(() =>
      expect(textarea.className).toContain('text-transparent')
    );
  });

  it('drops a mention when its text is edited away', async () => {
    const { textarea } = renderHarness();
    type(textarea, '/');
    await screen.findAllByRole('option');
    key(textarea, 'Enter');
    await waitFor(() => expect(stagedRow('Phở bò')).toBeVisible());

    // Breaking the name must drop the reference too — a half-deleted dish
    // silently logging a whole one is the failure this guards.
    type(textarea, 'Ph');
    await waitFor(() => expect(stagedRow('Phở bò')).toBeNull());
    expect(mentionText()).toEqual([]);
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

    await waitFor(() => expect(stagedRow('Phở gà')).toBeVisible());
  });

  it('crosses from the last dish into the first meal without a dead stop', async () => {
    const { textarea } = renderHarness();
    type(textarea, '/');
    await screen.findAllByRole('option');

    key(textarea, 'ArrowDown');
    key(textarea, 'ArrowDown'); // index 2 = the meals group's first row
    key(textarea, 'Enter');

    await waitFor(() => expect(stagedRow('phở bò với trà đá')).toBeVisible());
  });

  it('sums the staged totals across several picks', async () => {
    const { textarea } = renderHarness();
    type(textarea, '/');
    await screen.findAllByRole('option');
    key(textarea, 'Enter');
    await waitFor(() => expect(stagedRow('Phở bò')).toBeVisible());

    type(textarea, `${textarea.value}/`);
    await screen.findAllByRole('option');
    key(textarea, 'ArrowDown');
    key(textarea, 'Enter');

    // 420 + 380
    await waitFor(() => expect(screen.getByText('800 kcal')).toBeVisible());
    expect(mentionText()).toEqual(['Phở bò', 'Phở gà']);
  });

  it('removes a staged row and updates the total', async () => {
    const { textarea } = renderHarness();
    type(textarea, '/');
    await screen.findAllByRole('option');
    key(textarea, 'Enter');
    await waitFor(() => expect(stagedRow('Phở bò')).toBeVisible());

    fireEvent.click(screen.getByRole('button', { name: 'Bỏ Phở bò' }));

    // Removing the row also removes its text from the composer.
    await waitFor(() => expect(stagedRow('Phở bò')).toBeNull());
    expect(textarea.value).toBe('');
    expect(mentionText()).toEqual([]);
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

  it('pure relog: stages a review card from the picks alone (no AI)', async () => {
    const onAiSubmit = vi.fn();
    const { textarea } = renderHarness(undefined, 'normal', onAiSubmit);
    type(textarea, '/');
    await screen.findAllByRole('option');
    key(textarea, 'Enter');
    await waitFor(() => expect(stagedRow('Phở bò')).toBeVisible());

    key(textarea, 'Enter');

    // Deterministic staging, not the AI path.
    await waitFor(() => expect(stageRelog).toHaveBeenCalled());
    expect(onAiSubmit).not.toHaveBeenCalled();
    expect(stageRelog.mock.calls[0][0].items).toEqual([
      {
        kind: 'dish',
        sourceMealId: '11111111-1111-4111-8111-111111111111',
        mealItemOrder: 0,
      },
    ]);
    // The mention text is consumed once staged.
    await waitFor(() => expect(textarea.value).toBe(''));
  });

  it('restores the picks when a combined submit fails to durably stage', async () => {
    // handleSubmit resolves false when the stream errors, clarifies, or ends
    // without an analysis_complete. The picks must survive so the user can
    // retry — silently dropping them is the failure this guards.
    const onAiSubmit = vi.fn();
    const { textarea } = renderHarness(undefined, 'normal', onAiSubmit);
    // Make the AI submit report "did not durably stage".
    onAiSubmit.mockReturnValue(false);

    type(textarea, '/');
    await screen.findAllByRole('option');
    key(textarea, 'Enter');
    await waitFor(() => expect(stagedRow('Phở bò')).toBeVisible());

    type(textarea, `${textarea.value}và cơm`);
    key(textarea, 'Enter');

    await waitFor(() => expect(onAiSubmit).toHaveBeenCalled());
    // Failed durable stage ⇒ the pick is restored (still staged), not consumed,
    // and the AI carried only the free text with the pick as a ref.
    expect(stagedRow('Phở bò')).toBeVisible();
    expect(onAiSubmit.mock.calls[0][0].message).toBe('và cơm');
    expect(onAiSubmit.mock.calls[0][0].refs).toHaveLength(1);
    expect(stageRelog).not.toHaveBeenCalled();
  });

  it('combined: free text runs the AI with the picks passed as refs', async () => {
    const onAiSubmit = vi.fn();
    const { textarea } = renderHarness(undefined, 'normal', onAiSubmit);
    type(textarea, '/');
    await screen.findAllByRole('option');
    key(textarea, 'Enter');
    await waitFor(() => expect(stagedRow('Phở bò')).toBeVisible());

    // Free text typed alongside the pick.
    type(textarea, `${textarea.value}thêm trà đá`);
    key(textarea, 'Enter');

    // The picks NEVER re-analyze: only the free text goes to the AI, the picks
    // ride along as refs for the server to merge deterministically.
    await waitFor(() => expect(onAiSubmit).toHaveBeenCalled());
    expect(stageRelog).not.toHaveBeenCalled();
    const override = onAiSubmit.mock.calls[0][0];
    expect(override.message).toBe('thêm trà đá');
    expect(override.refs).toEqual([
      {
        kind: 'dish',
        sourceMealId: '11111111-1111-4111-8111-111111111111',
        mealItemOrder: 0,
      },
    ]);
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
    await waitFor(() => expect(stagedRow('Phở bò')).toBeVisible());
    // The staged draft is debounced; let it flush.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 600));
    });
    first.unmount();

    renderHarness();
    await waitFor(() => expect(stagedRow('Phở bò')).toBeVisible());
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
    await waitFor(() => expect(stagedRow('Phở bò')).toBeVisible());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 600));
    });
    first.unmount();

    // Same draft, cheat mode.
    const cheat = renderHarness(undefined, 'cheat');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(stagedRow('Phở bò')).toBeNull();
    // The mention TEXT is still in the composer — it is ordinary text now, and
    // untinted here — so submit stays armed. What must not happen is a relog.
    expect(mentionText()).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Phân tích' }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(stageRelog).not.toHaveBeenCalled();
    cheat.unmount();

    // Back in normal mode the draft is still there.
    renderHarness();
    await waitFor(() => expect(stagedRow('Phở bò')).toBeVisible());
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
