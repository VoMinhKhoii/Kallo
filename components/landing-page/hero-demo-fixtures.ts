/**
 * Precomputed analyses for the playable hero demo.
 *
 * The landing page must never call the live AI pipeline — these are hand-set,
 * realistic point estimates (per the founder direction: point values only, no
 * surfaced ranges or confidence). Each fixture maps a Vietnamese meal string to
 * the ingredient rows and total the staged demo reveals.
 */

export interface HeroDemoRow {
  /** Display name, diacritics preserved. */
  name: string;
  /** Whole-number kcal for the row (point value, no range surfaced). */
  cal: number;
}

export interface HeroDemoFixture {
  /** Stable key, also used as the chip label's translation key. */
  id: string;
  /** The exact meal text typed into the composer for this fixture. */
  text: string;
  rows: HeroDemoRow[];
  /** Total kcal — kept consistent with the row sum. */
  total: number;
}

/** The canned meal that auto-plays once on mount. */
export const HERO_AUTOPLAY_ID = 'mucKho';

export const HERO_DEMO_FIXTURES: readonly HeroDemoFixture[] = [
  {
    id: 'mucKho',
    text: '2 mực kho mặn + 50gr nạc dăm luộc + 1 chén cơm + canh chua',
    rows: [
      { name: 'Mực kho (2)', cal: 180 },
      { name: 'Nạc dăm (50g)', cal: 145 },
      { name: 'Cơm trắng (1 chén)', cal: 200 },
      { name: 'Canh chua', cal: 60 },
    ],
    total: 585,
  },
  {
    id: 'phoBo',
    text: '1 tô phở bò tái + quẩy',
    rows: [
      { name: 'Phở bò tái (1 tô)', cal: 420 },
      { name: 'Quẩy (1)', cal: 110 },
    ],
    total: 530,
  },
  {
    id: 'comTam',
    text: 'cơm tấm sườn bì chả + trứng ốp la',
    rows: [
      { name: 'Sườn nướng', cal: 290 },
      { name: 'Cơm tấm', cal: 240 },
      { name: 'Bì + chả', cal: 160 },
      { name: 'Trứng ốp la', cal: 95 },
    ],
    total: 785,
  },
  {
    id: 'bunCha',
    text: 'bún chả Hà Nội, 1 phần',
    rows: [
      { name: 'Chả nướng', cal: 260 },
      { name: 'Bún (1 phần)', cal: 200 },
      { name: 'Nước chấm + rau', cal: 70 },
    ],
    total: 530,
  },
];

export function getHeroFixture(id: string): HeroDemoFixture {
  return (
    HERO_DEMO_FIXTURES.find((fixture) => fixture.id === id) ??
    HERO_DEMO_FIXTURES[0]
  );
}

/** The 3 chips offered after autoplay (everything except the autoplay meal). */
export const HERO_CHIP_IDS = HERO_DEMO_FIXTURES.filter(
  (fixture) => fixture.id !== HERO_AUTOPLAY_ID
).map((fixture) => fixture.id);
