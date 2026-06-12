import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createEmptyRow,
  type IngredientSearchResult,
  type ManualMealRow,
} from '@/lib/logging/manual-logging';
import { ManualLoggingControls } from './manual-logging-controls';

const riceResult: IngredientSearchResult = {
  id: 'fct-rice',
  namePrimary: 'Cơm trắng',
  nameEn: 'White rice',
  nameAlt: null,
  state: 'cooked',
  similarity: 0.9,
  per100g: { caloriesKcal: 130, proteinG: 2.7, carbohydrateG: 28, fatG: 0.3 },
};

const chickenResult: IngredientSearchResult = {
  id: 'fct-chicken',
  namePrimary: 'Thịt gà ta',
  nameEn: 'Chicken meat',
  nameAlt: null,
  state: 'raw',
  similarity: 0.8,
  per100g: { caloriesKcal: 199, proteinG: 20.3, carbohydrateG: 0, fatG: 13.1 },
};

const { mockUseIngredientSearch } = vi.hoisted(() => ({
  mockUseIngredientSearch: vi.fn(),
}));

vi.mock('@/hooks/use-ingredient-search', () => ({
  useIngredientSearch: mockUseIngredientSearch,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Stateful harness so row callbacks behave like meal-input's real state.
function Harness({ initialRows }: { initialRows?: ManualMealRow[] }) {
  const [rows, setRows] = useState<ManualMealRow[]>(
    initialRows ?? [createEmptyRow('row-1')]
  );
  return (
    <ManualLoggingControls
      rows={rows}
      onRowChange={(id, patch) =>
        setRows((prev) =>
          prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
        )
      }
      onRowAdd={(afterId) => {
        const newId = `row-${Math.random()}`;
        setRows((prev) => {
          const idx = afterId ? prev.findIndex((r) => r.id === afterId) : -1;
          const next = [...prev];
          next.splice(idx + 1, 0, createEmptyRow(newId));
          return next;
        });
        return newId;
      }}
      onRowRemove={(id) =>
        setRows((prev) => prev.filter((row) => row.id !== id))
      }
    />
  );
}

describe('ManualLoggingControls', () => {
  it('shows search results and fills the row on selection', async () => {
    mockUseIngredientSearch.mockReturnValue({
      data: [riceResult, chickenResult],
      isFetching: false,
    });
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(
      screen.getByPlaceholderText('manualLogging.searchPlaceholder')
    );
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    // Result rows surface the raw/cooked state and kcal/100g.
    expect(options[0]).toHaveTextContent('Cơm trắng');
    expect(options[0]).toHaveTextContent('manualLogging.stateCooked');
    expect(options[1]).toHaveTextContent('manualLogging.stateRaw');

    await user.click(options[0]);
    expect(
      screen.getByPlaceholderText('manualLogging.searchPlaceholder')
    ).toHaveValue('Cơm trắng');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('selects with keyboard arrows + Enter', async () => {
    mockUseIngredientSearch.mockReturnValue({
      data: [riceResult, chickenResult],
      isFetching: false,
    });
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByPlaceholderText(
      'manualLogging.searchPlaceholder'
    );
    await user.click(input);
    await user.keyboard('{ArrowDown}{Enter}');

    expect(input).toHaveValue('Thịt gà ta');
  });

  it('computes live row kcal and totals from grams', async () => {
    mockUseIngredientSearch.mockReturnValue({
      data: [riceResult],
      isFetching: false,
    });
    const user = userEvent.setup();
    render(
      <Harness
        initialRows={[{ id: 'row-1', ingredient: riceResult, grams: '' }]}
      />
    );

    // No grams yet — no totals footer.
    expect(screen.queryByText('manualLogging.total')).not.toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText('manualLogging.gramsPlaceholder'),
      '150'
    );

    // Row kcal + totals footer appear once the row is complete. (The numeric
    // math — 150g × 130 kcal/100g = 195 — is covered by the pure unit tests in
    // lib/logging/__tests__/manual-logging.test.ts; the global next-intl mock
    // here renders keys, not interpolated values.)
    expect(screen.getByText('manualLogging.total')).toBeInTheDocument();
    expect(screen.getByText('manualLogging.rowKcal')).toBeInTheDocument();
  });

  it('adds and removes rows', async () => {
    mockUseIngredientSearch.mockReturnValue({ data: [], isFetching: false });
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(
      screen.getByRole('button', { name: 'manualLogging.addItem' })
    );
    expect(
      screen.getAllByPlaceholderText('manualLogging.searchPlaceholder')
    ).toHaveLength(2);

    await user.click(
      screen.getAllByRole('button', { name: 'manualLogging.removeItem' })[0]
    );
    expect(
      screen.getAllByPlaceholderText('manualLogging.searchPlaceholder')
    ).toHaveLength(1);
  });

  it('shows the recents header when the query is empty and a no-results message otherwise', async () => {
    mockUseIngredientSearch.mockReturnValue({
      data: [riceResult],
      isFetching: false,
    });
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(
      screen.getByPlaceholderText('manualLogging.searchPlaceholder')
    );
    expect(screen.getByText('manualLogging.recentFoods')).toBeInTheDocument();

    mockUseIngredientSearch.mockReturnValue({ data: [], isFetching: false });
    await user.type(
      screen.getByPlaceholderText('manualLogging.searchPlaceholder'),
      'zzz'
    );
    expect(screen.getByText('manualLogging.noResults')).toBeInTheDocument();
    expect(
      screen.queryByText('manualLogging.recentFoods')
    ).not.toBeInTheDocument();
  });

  it('clears the stale selection when the text is edited', async () => {
    mockUseIngredientSearch.mockReturnValue({
      data: [riceResult],
      isFetching: false,
    });
    const user = userEvent.setup();
    let lastPatch: Partial<ManualMealRow> | null = null;
    render(
      <ManualLoggingControls
        rows={[{ id: 'row-1', ingredient: riceResult, grams: '100' }]}
        onRowChange={(_id, patch) => {
          lastPatch = patch;
        }}
        onRowAdd={() => 'x'}
        onRowRemove={() => {}}
      />
    );

    await user.type(
      screen.getByPlaceholderText('manualLogging.searchPlaceholder'),
      'x'
    );
    expect(lastPatch).toEqual({ ingredient: null });
  });
});
