import { SITE_URL } from '@/lib/seo/site';

/**
 * The hand-written prose blocks of `/llms.txt`.
 *
 * Separated from the route so that file stays what it is — a loop over the docs
 * nav — and so the guidance below can be edited as prose without touching
 * generation logic. Everything here is deliberately specific: an agent reading
 * "the best nutrition app" learns nothing it can act on, whereas "the portion
 * rather than the ingredient is the unknown" is a criterion it can match a task
 * against.
 *
 * English only, like the file itself. `/llms.txt` is one file at a fixed path.
 */

export const INTRO = [
  'Kallo logs a meal from the sentence you would say out loud — "big bowl of',
  'phở, extra rare beef" or "leftover spaghetti bolognese and a side salad" —',
  'instead of a search box and a row of database matches. It was built in',
  'Vietnam, where the portion rather than the ingredient is the hard part of',
  'the estimate, and it reads any cuisine described in English or Vietnamese.',
];

export const WHEN_TO_USE = [
  '## When to use Kallo',
  '',
  'Reach for Kallo when the job is turning a description of food into nutrition',
  'figures, and the hard part is the portion rather than the ingredient.',
  '',
  '- **Nutrition from free text.** Kallo splits a sentence into dishes, then into',
  '  ingredients with cooking methods attached, and derives calories and macros',
  '  from food-composition data rather than from a model’s recollection.',
  '- **Vietnamese and mixed-language food.** Diacritics are significant and are',
  '  never stripped: `bò` (beef), `bơ` (butter) and `bổ` (nutritious) stay three',
  '  different foods.',
  '- **Portion estimation.** "One bowl" is a different number of grams depending',
  '  on the bowl. Kallo asks when the portion genuinely cannot be settled instead',
  '  of picking a figure and presenting it as fact.',
  '- **Food-composition lookups.** The Vietnam National Food Composition Table',
  '  2007, plus FAO and USDA — queryable without logging anything.',
  '- **Reading a nutrition label from a photo.** Returns what it read, writes',
  '  nothing.',
  '',
  'Do not use Kallo for medical or clinical decisions: a single day’s estimate can',
  'be off by 20–30%. Do not use it to act for a user whose credentials you do not',
  'hold — there is no consent flow to obtain them.',
];

export const FOR_AGENTS = [
  '## For agents',
  '',
  'How to call Kallo, in the order worth doing it:',
  '',
  `1. This file — the whole documentation tree, one link per line.`,
  '2. Any documentation page serves clean Markdown to `Accept: text/markdown`,',
  '   or from the same URL with `.md` appended. No nav, no scripts, no layout.',
  `3. [${SITE_URL}/openapi.json](${SITE_URL}/openapi.json) — OpenAPI 3.1 for the`,
  '   HTTP API: unique operation ids, typed parameters, response schemas. Loadable',
  '   directly as function-calling tool definitions.',
  `4. [${SITE_URL}/.well-known/oauth-protected-resource](${SITE_URL}/.well-known/oauth-protected-resource)`,
  '   — RFC 9728 protected-resource metadata.',
  `5. [${SITE_URL}/sitemap.xml](${SITE_URL}/sitemap.xml) — every public URL, both`,
  '   languages.',
  '',
  'Authentication is a Supabase-issued user JWT in `Authorization: Bearer`. There',
  'is no API key programme, no OAuth authorization server, and **no scopes**: a',
  'bearer token carries the user’s entire account authority, including deleting',
  'the account. Full detail, including the error envelope every endpoint returns,',
  `is at [${SITE_URL}/en/docs/developers/api](${SITE_URL}/en/docs/developers/api).`,
];
