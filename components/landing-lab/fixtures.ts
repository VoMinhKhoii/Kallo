/**
 * Precomputed analyses for the lab demo — the prototypes never call the
 * live AI pipeline. The autoplay meal is Vietnamese (heritage as the
 * opening note); the chips are deliberately global, telling the
 * "any meal, any language" pivot in one interaction.
 *
 * Totals are bounded ranges that bracket the row sum — the brand rule is
 * honest bounds, never fake precision.
 */

export interface LabDemoRow {
  /** Display name, diacritics preserved. */
  name: string;
  /** Whole-number kcal for the row. */
  cal: number;
}

export interface LabDemoFixture {
  id: string;
  /** The exact meal text typed into the command bar. */
  text: string;
  /** Short label for the suggestion chip. */
  chipLabel: string;
  rows: LabDemoRow[];
  /** Bounded estimate bracketing the row sum, e.g. "505–560". */
  totalRange: string;
}

/** The canned meal that auto-plays once on mount. */
export const LAB_AUTOPLAY_ID = 'phoBo';

export const LAB_FIXTURES: readonly LabDemoFixture[] = [
  {
    id: 'phoBo',
    text: '1 tô phở bò tái + quẩy',
    chipLabel: 'phở bò tái + quẩy',
    rows: [
      { name: 'Phở bò tái (1 tô)', cal: 420 },
      { name: 'Quẩy (1)', cal: 110 },
    ],
    totalRange: '505–560',
  },
  {
    id: 'avocadoToast',
    text: 'avocado toast on sourdough, 2 poached eggs',
    chipLabel: 'avocado toast + poached eggs',
    rows: [
      { name: 'Sourdough slice', cal: 110 },
      { name: 'Avocado (½)', cal: 120 },
      { name: 'Poached eggs (2)', cal: 140 },
      { name: 'Olive-oil drizzle', cal: 40 },
    ],
    totalRange: '385–435',
  },
  {
    id: 'chickenTikka',
    text: 'chicken tikka masala with basmati rice',
    chipLabel: 'chicken tikka masala + basmati',
    rows: [
      { name: 'Chicken tikka masala', cal: 320 },
      { name: 'Basmati rice', cal: 180 },
    ],
    totalRange: '470–530',
  },
  {
    id: 'spagBol',
    text: 'leftover spaghetti bolognese, small bowl + side salad',
    chipLabel: 'leftover spag bol + salad',
    rows: [
      { name: 'Spaghetti bolognese (small)', cal: 380 },
      { name: 'Side salad + dressing', cal: 90 },
    ],
    totalRange: '440–495',
  },
];

export function getLabFixture(id: string): LabDemoFixture {
  return LAB_FIXTURES.find((fixture) => fixture.id === id) ?? LAB_FIXTURES[0];
}

/** Chips offered once the demo turns interactive (everything but autoplay). */
export const LAB_CHIP_IDS = LAB_FIXTURES.filter(
  (fixture) => fixture.id !== LAB_AUTOPLAY_ID
).map((fixture) => fixture.id);
