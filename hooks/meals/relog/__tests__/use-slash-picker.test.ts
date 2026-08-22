import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSlashPicker } from '@/hooks/meals/relog/use-slash-picker';
import type { RelogCandidate } from '@/lib/domain/logging/relog/relog';

const candidate = (name: string): RelogCandidate => ({
  kind: 'dish',
  sourceMealId: '11111111-1111-4111-8111-111111111111',
  mealItemOrder: 0,
  name,
  ingredientCount: 1,
  occurrenceCount: 1,
  lastLoggedAt: new Date().toISOString(),
  totalGrams: 100,
  caloriesKcal: 200,
  proteinG: null,
  carbohydrateG: null,
  fatG: null,
});

const OPTIONS = [candidate('Phở bò'), candidate('Phở gà'), candidate('Trà đá')];

/** A real textarea, so caret handling is exercised rather than simulated. */
function setup(opts: { enabled?: boolean } = {}) {
  const el = document.createElement('textarea');
  document.body.appendChild(el);
  // Mirrors what useStagedEntries does: replace the token with the label and
  // hand the result back for the picker to write.
  const onSelect = vi.fn(
    (
      candidate: RelogCandidate,
      value: string,
      token: { start: number; end: number }
    ) => {
      const next =
        value.slice(0, token.start) +
        candidate.name +
        ' ' +
        value.slice(token.end);
      return { value: next, caret: token.start + candidate.name.length + 1 };
    }
  );
  const setText = vi.fn((text: string, caret?: number) => {
    el.value = text;
    if (caret !== undefined) el.setSelectionRange(caret, caret);
  });

  const view = renderHook(() =>
    useSlashPicker({
      getTextarea: () => el,
      setText,
      onSelect,
      enabled: opts.enabled ?? true,
    })
  );

  const type = (value: string, caret = value.length) => {
    el.value = value;
    el.setSelectionRange(caret, caret);
    act(() => view.result.current.syncFromTextarea());
    act(() => view.result.current.setOptions(OPTIONS));
  };

  const press = (key: string) => {
    const event = {
      key,
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;
    let consumed = false;
    act(() => {
      consumed = view.result.current.handleKeyDown(event);
    });
    return { consumed, event };
  };

  return { el, view, type, press, onSelect, setText };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('useSlashPicker', () => {
  it('stays closed until a slash token appears', () => {
    const { view, type } = setup();
    expect(view.result.current.isOpen).toBe(false);
    type('phở bò');
    expect(view.result.current.isOpen).toBe(false);
    type('/pho');
    expect(view.result.current.isOpen).toBe(true);
    expect(view.result.current.query).toBe('pho');
  });

  it('does not open on a mid-word slash', () => {
    const { view, type } = setup();
    type('1/2 quả táo');
    expect(view.result.current.isOpen).toBe(false);
  });

  it('closes when the caret moves left of the slash', () => {
    const { view, type } = setup();
    type('/pho');
    expect(view.result.current.isOpen).toBe(true);
    type('/pho', 0);
    expect(view.result.current.isOpen).toBe(false);
  });

  it('does nothing at all when disabled', () => {
    const { view, type } = setup({ enabled: false });
    type('/pho');
    expect(view.result.current.isOpen).toBe(false);
  });

  it('moves the highlight with the arrows and clamps at both ends', () => {
    const { view, type, press } = setup();
    type('/');
    expect(view.result.current.highlighted).toBe(0);

    press('ArrowUp');
    expect(view.result.current.highlighted).toBe(0); // clamped, not wrapping

    press('ArrowDown');
    press('ArrowDown');
    expect(view.result.current.highlighted).toBe(2);

    press('ArrowDown');
    expect(view.result.current.highlighted).toBe(2); // clamped at the end
  });

  it('preventDefaults the arrows so the caret does not move', () => {
    const { type, press } = setup();
    type('/');
    expect(press('ArrowDown').event.preventDefault).toHaveBeenCalled();
  });

  it('selects the highlighted option on Enter and strips the token', () => {
    const { el, type, press, onSelect } = setup();
    type('xem /pho');
    press('ArrowDown');
    const { consumed } = press('Enter');

    expect(consumed).toBe(true);
    expect(onSelect.mock.calls[0][0]).toBe(OPTIONS[1]);
    // The pick lands as text in the composer rather than vanishing into a list.
    expect(el.value).toBe('xem Phở gà ');
    expect(el.selectionStart).toBe(11);
  });

  it('selects on Tab as well', () => {
    const { type, press, onSelect } = setup();
    type('/pho');
    press('Tab');
    expect(onSelect.mock.calls[0][0]).toBe(OPTIONS[0]);
  });

  it('preserves text to the right of the token when selecting', () => {
    const { el, type, press } = setup();
    // Caret sits after "/pho"; " và cơm" trails it and must survive.
    type('/pho và cơm', 4);
    press('Enter');
    expect(el.value).toBe('Phở bò  và cơm');
  });

  it('closes the picker after a selection', () => {
    const { view, type, press } = setup();
    type('/pho');
    press('Enter');
    expect(view.result.current.isOpen).toBe(false);
  });

  it('swallows Enter when there are no results', () => {
    // Submitting the literal "/pho" text to the AI pipeline is never intended.
    const { view, type, press, onSelect } = setup();
    type('/pho');
    act(() => view.result.current.setOptions([]));
    const { consumed, event } = press('Enter');
    expect(consumed).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('lets every key through while closed, so Enter still submits', () => {
    const { press } = setup();
    expect(press('Enter').consumed).toBe(false);
    expect(press('ArrowDown').consumed).toBe(false);
    expect(press('Escape').consumed).toBe(false);
  });

  it('dismisses on Escape without touching the text', () => {
    const { el, view, type, press } = setup();
    type('/pho');
    press('Escape');
    expect(view.result.current.isOpen).toBe(false);
    expect(el.value).toBe('/pho');
  });

  it('does not re-open while typing into a dismissed token', () => {
    const { view, type, press } = setup();
    type('/pho');
    press('Escape');
    type('/phob');
    expect(view.result.current.isOpen).toBe(false);
  });

  it('re-opens for a NEW slash after a dismissal', () => {
    const { view, type, press } = setup();
    type('/pho');
    press('Escape');
    type('/pho /tra');
    expect(view.result.current.isOpen).toBe(true);
    expect(view.result.current.query).toBe('tra');
  });

  it('re-anchors the highlight when the query changes', () => {
    const { view, type, press } = setup();
    type('/');
    press('ArrowDown');
    expect(view.result.current.highlighted).toBe(1);
    type('/pho');
    expect(view.result.current.highlighted).toBe(0);
  });

  it('re-anchors the highlight when the option list shrinks under it', () => {
    const { view, type, press } = setup();
    type('/');
    press('ArrowDown');
    press('ArrowDown');
    expect(view.result.current.highlighted).toBe(2);
    act(() => view.result.current.setOptions([OPTIONS[0]]));
    expect(view.result.current.highlighted).toBe(0);
  });
});
