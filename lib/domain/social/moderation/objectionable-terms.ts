// ---------------------------------------------------------------------------
// The curated objectionable-term list behind text-filter.ts. DATA ONLY.
// ---------------------------------------------------------------------------
// Deliberately modest and conservative: every entry is matched as a WHOLE word
// or phrase, never as a substring, and each one was checked against food words
// a meal tracker actually sees. A false positive blocks someone typing their
// lunch; a false negative is caught by the report button. When in doubt, leave
// a term out.
//
// Vietnamese entries keep their diacritics — the tone marks are what separate
// a profanity from a fruit (buồi ≠ bưởi), a dance (đụ ≠ đu đủ) or a pronoun
// (the ethnic slur "mọi" is NOT listed: "mọi người" means "everyone"). ASCII
// Vietnamese is listed only where the unaccented spelling has no innocent
// reading. Also NOT listed, on purpose: "óc chó" (an insult, but "hạt óc chó"
// is a walnut), "cock" / "dick" / "pussy" (rooster, spotted dick, cat), bare
// "kill" (a workout "kills" you).
//
// Categories mirror the report reasons: slurs (hate), sexual, violence /
// self-harm incitement. Lowercase; text-filter.ts normalises input the same
// way (NFC, lowercase) before matching.

const EN_SLURS = [
  'nigger',
  'niggers',
  'nigga',
  'niggas',
  'faggot',
  'faggots',
  'retard',
  'retarded',
  'retards',
  'chink',
  'chinks',
  'gook',
  'gooks',
  'kike',
  'kikes',
  'spic',
  'spics',
  'wetback',
  'wetbacks',
  'tranny',
  'trannies',
];

const EN_SEXUAL = [
  'fuck',
  'fucks',
  'fucked',
  'fucker',
  'fuckers',
  'fucking',
  'motherfucker',
  'motherfuckers',
  'cunt',
  'cunts',
  'whore',
  'whores',
  'slut',
  'sluts',
  'blowjob',
  'porn',
  'rape',
  'raped',
  'rapist',
  'rapists',
];

const EN_VIOLENCE = [
  'kill yourself',
  'kys',
  'hang yourself',
  'go die',
  'i will kill you',
  "i'll kill you",
];

const VI_SEXUAL = [
  'địt',
  'đụ',
  'lồn',
  'buồi',
  'cặc',
  'đĩ',
  'hiếp dâm',
  // Unaccented spellings with no innocent reading.
  'dcm',
  'djt',
  'dit me',
  'dit con me',
];

// Not "chết đi": "ngon chết đi được" is "delicious to die for".
const VI_VIOLENCE = ['giết mày', 'tự tử đi'];

export const OBJECTIONABLE_TERMS: readonly string[] = [
  ...EN_SLURS,
  ...EN_SEXUAL,
  ...EN_VIOLENCE,
  ...VI_SEXUAL,
  ...VI_VIOLENCE,
];
