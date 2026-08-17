/**
 * Generate `scripts/eval/fixtures/adjustment-sensitivity.json` from the live
 * capture in `scripts/eval/landing-v2.json`.
 *
 * These cases exist to guard one property: when a user states a small
 * preparation detail, the estimate must MOVE, in the direction the words
 * imply. Every regression this session (cooking-method broadcast, snap-to-base,
 * species collision, skin-only rows) showed up first as a comparison going flat
 * or inverting — not as a single case being wrong.
 *
 * Bands are ±30%, matching the schema's own guidance: wide enough to survive
 * legitimate run-to-run variance at temperature 0.3/0.4, tight enough to catch
 * the 2x-class errors that hurt users.
 *
 * The capture it reads is NOT committed — it is ~1.1 MB of raw pipeline output
 * per run. Produce one first with `bun scripts/eval/local/capture-landing-v2.ts`
 * (needs a remote `DATABASE_URL` and `GEMINI_API_KEY`). The generated fixture
 * is the committed artefact; the capture behind it is disposable, which is why
 * provenance carries the capture's exact instant.
 *
 * Run: bun scripts/eval/gen-adjustment-fixtures.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';

const CAPTURE = 'scripts/eval/landing-v2.json';
const OUT = 'scripts/eval/fixtures/adjustment-sensitivity.json';

/** Cases that earned their place: the delta is real AND attributable. */
const KEEP: Array<{ key: string; id: string; tags: string[]; note: string }> = [
  {
    key: 'fat.vi.default',
    id: 'adj-vn-thigh-plain',
    tags: ['vi', 'adjustment', 'fat-trim'],
    note: 'Baseline for the skin-removal pair.',
  },
  {
    key: 'fat.vi.trimmed',
    id: 'adj-vn-thigh-skinless',
    tags: ['vi', 'adjustment', 'fat-trim'],
    note: 'bỏ da must cut fat. Regressed to FLAT when đùi gà matched a skinless pheasant row.',
  },
  {
    key: 'fat.en.default',
    id: 'adj-en-thigh-plain',
    tags: ['en', 'adjustment', 'fat-trim'],
    note: 'Baseline for the skin-removal pair.',
  },
  {
    key: 'fat.en.trimmed',
    id: 'adj-en-thigh-skinless',
    tags: ['en', 'adjustment', 'fat-trim'],
    note: 'Thigh fat density fell 9.0 -> 5.4 g/100g at capture.',
  },

  {
    key: 'oil.vi.default',
    id: 'adj-vn-tofu-fried',
    tags: ['vi', 'adjustment', 'cooking-oil'],
    note: 'Default: đậu hũ is fried unless stated otherwise.',
  },
  {
    key: 'oil.vi.light',
    id: 'adj-vn-tofu-light-oil',
    tags: ['vi', 'adjustment', 'cooking-oil'],
    note: 'chiên ít dầu.',
  },
  {
    key: 'oil.vi.none',
    id: 'adj-vn-tofu-no-oil',
    tags: ['vi', 'adjustment', 'cooking-oil'],
    note: 'nướng không dầu. Tofu held at 150g across all three at capture; only the oil moved.',
  },

  {
    key: 'rawcooked.vi.default',
    id: 'adj-vn-weight-as-eaten',
    tags: ['vi', 'adjustment', 'weight-basis'],
    note: 'Baseline: 300g treated as as-eaten.',
  },
  {
    key: 'rawcooked.vi.raw',
    id: 'adj-vn-weight-raw',
    tags: ['vi', 'adjustment', 'weight-basis'],
    note: 'cân sống: 300g raw yields less cooked mass, so protein must DROP.',
  },
  {
    key: 'rawcooked.en.default',
    id: 'adj-en-weight-as-eaten',
    tags: ['en', 'adjustment', 'weight-basis'],
    note: 'Baseline: 300g treated as as-eaten.',
  },
  {
    key: 'rawcooked.en.raw',
    id: 'adj-en-weight-raw',
    tags: ['en', 'adjustment', 'weight-basis'],
    note: 'raw-weight: protein must DROP relative to the as-eaten baseline.',
  },

  {
    key: 'rice.en.one',
    id: 'adj-en-rice-one-cup',
    tags: ['en', 'adjustment', 'portion-count'],
    note: 'Baseline for the explicit-count pair.',
  },
  {
    key: 'rice.en.two',
    id: 'adj-en-rice-two-cups',
    tags: ['en', 'adjustment', 'portion-count'],
    note: 'Doubling an explicit count must roughly double carbs. Guards the profile-portion failure: stored defaultRicePortion never moved the estimate.',
  },

  {
    key: 'portion.vi.containers',
    id: 'adj-vn-three-containers',
    tags: ['vi', 'vessel', 'portion'],
    note: 'One sentence must yield plate + bowl + cup.',
  },
  {
    key: 'portion.en.containers',
    id: 'adj-en-three-containers',
    tags: ['en', 'vessel', 'portion'],
    note: 'One sentence must yield plate + bowl + cup.',
  },
  {
    key: 'portion.vi.fish',
    id: 'adj-vn-piece-fish',
    tags: ['vi', 'vessel', 'portion'],
    note: 'phi lê must resolve a fish piece vessel.',
  },
  {
    key: 'portion.vi.beef',
    id: 'adj-vn-piece-beef',
    tags: ['vi', 'vessel', 'portion'],
    note: 'miếng must resolve a meat piece vessel.',
  },
  {
    key: 'portion.vi.poultry',
    id: 'adj-vn-piece-poultry',
    tags: ['vi', 'vessel', 'portion'],
    note: 'Regressed to 1491 kcal / 122g fat when gà rán matched a chicken-SKIN row.',
  },
];

const band = (v: number, pct = 0.3): [number, number] => [
  Math.max(0, Math.round(v * (1 - pct))),
  Math.round(v * (1 + pct)),
];

const capture = JSON.parse(readFileSync(CAPTURE, 'utf8'));

// Read the stamp off the capture rather than hard-coding it: provenance is only
// worth recording if it names the run that actually produced these bands. Kept
// as the full ISO instant, not a date — the capture that produced these ran at
// 17:59Z, which is already the next day in the timezone it was run from, and a
// provenance field that flips by a day depending on who reads it is worse than
// none.
const CAPTURED_AT = String(capture.capturedAt ?? '');
if (!CAPTURED_AT) throw new Error(`${CAPTURE} has no capturedAt timestamp`);

const cases = [];

for (const spec of KEEP) {
  const row = capture.byKey[spec.key];
  if (!row) {
    console.warn(`skip ${spec.key} — not in capture`);
    continue;
  }
  const t = row.parsed.totalMacros;
  // Container vessels only: the schema's vesselExpectationSchema accepts
  // bowl|plate|cup and has no `piece` variant, so piece vessels cannot be
  // asserted declaratively yet (see the note in the fixture file).
  const containers = row.parsed.items
    .map((i: { vessel?: { family: string; tier: number } }) => i.vessel)
    .filter(
      (v: { family: string; tier: number } | undefined) =>
        v && ['bowl', 'plate', 'cup'].includes(v.family)
    )
    .map((v: { family: string; tier: number }) => ({
      family: v.family,
      tier: v.tier,
    }));

  cases.push({
    id: spec.id,
    input: row.text,
    tags: [...spec.tags, 'regression-bug'],
    tier: 'extended',
    expect: {
      isFood: true,
      noSilentZeros: true,
      kcalRange: band(t.calories),
      macroRanges: {
        proteinG: band(t.protein),
        carbohydrateG: band(t.carbs),
        fatG: band(t.fat, 0.35),
      },
      ...(spec.tags.includes('vessel') && containers.length > 0
        ? { expectVessel: containers }
        : {}),
    },
    provenance: {
      source: 'staging-confirmed',
      setAt: CAPTURED_AT,
      note: `${spec.note} Captured live ${CAPTURED_AT}: ${Math.round(t.calories)} kcal, P${Math.round(t.protein)} C${Math.round(t.carbs)} F${Math.round(t.fat)}.`,
    },
  });
}

const out = {
  version: 1,
  notes:
    'Adjustment sensitivity. Each pair asserts that a stated preparation detail MOVES the estimate in the implied direction. Every pipeline regression found on 2026-08-08 surfaced first as one of these comparisons going flat or inverting, not as a single case being wrong. Bands are +/-30% (fat +/-35%) so run-to-run variance at temperature 0.3/0.4 does not false-alarm. NOTE: piece vessels (fish/meat/poultry) cannot be asserted here — vesselExpectationSchema currently accepts bowl|plate|cup only; those cases rely on their macro bands, which is what caught the chicken-skin regression.',
  cases,
  relations: [
    {
      id: 'vn-tofu-oil-monotonic',
      kind: 'strictlyIncreasingFatMid',
      caseIds: [
        'adj-vn-tofu-no-oil',
        'adj-vn-tofu-light-oil',
        'adj-vn-tofu-fried',
      ],
      note: 'Fat must rise strictly with stated oil. This single assertion would have caught the snap-to-base guard, the cooking-method broadcast, and the fast-path skip — all three inverted or flattened it.',
    },
  ],
};

writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(
  `wrote ${OUT} — ${cases.length} cases, ${out.relations.length} relation(s)`
);
