import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createEmptyRow,
  type IngredientSearchResult,
  type ManualMealRow,
} from '@/lib/domain/logging/manual-logging';
import { ManualLoggingControls } from '../manual-logging-controls';

const riceResult: IngredientSearchResult = {
  id: 'fct-rice',
  namePrimary: 'Cơm trắng',
  nameEn: 'White rice',
  nameAlt: null,
  state: 'cooked',
  similarity: 0.9,
  per100g: { caloriesKcal: 130, proteinG: 2.7, carbohydrateG: 28, fatG: 0.3 },
  displayNameEn: 'Long-grain white rice, unsalted',
  stateLabel: 'cooked',
};

const chickenResult: IngredientSearchResult = {
  id: 'fct-chicken',
  namePrimary: 'Thịt gà ta',
  nameEn: 'Chicken meat',
  nameAlt: null,
  state: 'raw',
  similarity: 0.8,
  per100g: { caloriesKcal: 199, proteinG: 20.3, carbohydrateG: 0, fatG: 13.1 },
  displayNameEn: 'Chicken, meat and skin',
  stateLabel: 'raw',
};

// A canned food: the table says 'raw', but its card names no state.
const sardineResult: IngredientSearchResult = {
  id: 'fct-sardine',
  namePrimary: 'Cá mòi hộp',
  nameEn: 'Sardines, canned in oil',
  nameAlt: null,
  state: 'raw',
  similarity: 0.7,
  per100g: { caloriesKcal: 208, proteinG: 24.6, carbohydrateG: 0, fatG: 11.5 },
  displayNameEn: 'Canned sardines in oil',
  stateLabel: null,
};

const { mockUseIngredientSearch } = vi.hoisted(() => ({
  mockUseIngredientSearch: vi.fn(),
}));

vi.mock('@/hooks/meals/queries/use-ingredient-search', () => ({
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
  const [name, setName] = useState('');
  return (
    <ManualLoggingControls
      name={name}
      onNameChange={setName}
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
    // Result rows: the Vietnamese name, the card's state and English name,
    // and kcal per 100 g under the column header.
    expect(options[0]).toHaveTextContent('Cơm trắng');
    expect(options[0]).toHaveTextContent('stateCooked');
    expect(options[0]).toHaveTextContent('Long-grain white rice, unsalted');
    expect(options[0]).toHaveTextContent('130 kcal');
    expect(options[1]).toHaveTextContent('stateRaw');
    expect(screen.getByText('manualLogging.per100g')).toBeInTheDocument();

    await user.click(options[0]);
    expect(
      screen.getByPlaceholderText('manualLogging.searchPlaceholder')
    ).toHaveValue('Cơm trắng');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows no state for a food whose card names none', async () => {
    mockUseIngredientSearch.mockReturnValue({
      data: [sardineResult],
      isFetching: false,
    });
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(
      screen.getByPlaceholderText('manualLogging.searchPlaceholder')
    );
    const [option] = screen.getAllByRole('option');
    expect(option).toHaveTextContent('Canned sardines in oil');
    expect(option).not.toHaveTextContent('stateRaw');
  });

  it('names the meal, with its rows as the placeholder', async () => {
    mockUseIngredientSearch.mockReturnValue({ data: [], isFetching: false });
    const user = userEvent.setup();
    render(
      <Harness
        initialRows={[
          { id: 'row-1', query: '', ingredient: riceResult, grams: '150' },
          { id: 'row-2', query: 'gà', ingredient: chickenResult, grams: '100' },
        ]}
      />
    );

    const field = screen.getByPlaceholderText('Cơm trắng + gà');
    await user.type(field, 'Cơm gà');
    expect(field).toHaveValue('Cơm gà');
  });

  it('keeps the typed text and shows the picked DB name below it', async () => {
    mockUseIngredientSearch.mockReturnValue({
      data: [riceResult],
      isFetching: false,
    });
    const user = userEvent.setup();
    render(
      <Harness
        initialRows={[
          { id: 'row-1', query: 'cơm nhà', ingredient: null, grams: '' },
        ]}
      />
    );

    const input = screen.getByPlaceholderText(
      'manualLogging.searchPlaceholder'
    );
    await user.click(input);
    await user.click(screen.getByRole('option', { name: /Cơm trắng/ }));

    // The typed text is preserved (it's what gets saved)...
    expect(input).toHaveValue('cơm nhà');
    // ...and the matched DB entry's name shows below for reference.
    expect(screen.getAllByText('Cơm trắng').length).toBeGreaterThan(0);
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
        initialRows={[
          { id: 'row-1', query: '', ingredient: riceResult, grams: '' },
        ]}
      />
    );

    // No grams yet — no totals ring.
    expect(screen.queryByRole('img', { name: /kcal/ })).not.toBeInTheDocument();

    await user.type(
      screen.getByPlaceholderText('manualLogging.gramsPlaceholder'),
      '150'
    );

    // Row kcal + the macro ring appear once the row is complete: 150 g ×
    // 130 kcal/100 g = 195 in the ring's middle. (The global next-intl mock
    // renders the row's key, not its interpolated value.)
    expect(screen.getByRole('img', { name: '195 kcal' })).toBeInTheDocument();
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
    expect(screen.getByText('manualLogging.recent')).toBeInTheDocument();

    mockUseIngredientSearch.mockReturnValue({ data: [], isFetching: false });
    await user.type(
      screen.getByPlaceholderText('manualLogging.searchPlaceholder'),
      'zzz'
    );
    expect(screen.getByText('manualLogging.noResults')).toBeInTheDocument();
    expect(screen.queryByText('manualLogging.recent')).not.toBeInTheDocument();
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
        name=""
        onNameChange={() => {}}
        rows={[
          { id: 'row-1', query: '', ingredient: riceResult, grams: '100' },
        ]}
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
    expect(lastPatch).toEqual({ query: 'x', ingredient: null });
  });
});
