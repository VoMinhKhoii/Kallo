/**
 * MDX source → plain CommonMark, for the `text/markdown` representation of a
 * docs page.
 *
 * A line-oriented transform rather than an AST pass on purpose. The docs use
 * exactly four components (`Callout`, `Steps`, `Step`, `MealExample`), every
 * one of them with regular, hand-authored props, and `remark`'s MDX AST would
 * pull the whole compiler into a route that is meant to be cheap and static.
 * `markdown.test.ts` covers every construct that appears in `content/docs`;
 * if a fifth component is ever added, that test fails before the route ships
 * a page with a stray JSX tag in it.
 *
 * Everything not recognised is passed through untouched, which is the right
 * default: MDX is a superset of Markdown, so unrecognised prose is already
 * valid Markdown.
 */

const FENCE = /^ {0,3}(```|~~~)/;

/** `label="…"` / `tone="…"` / `title="…"` — MDX string props are quoted. */
function stringProp(source: string, name: string): string | null {
  const match = new RegExp(`${name}="([^"]*)"`).exec(source);
  return match ? match[1] : null;
}

interface Dish {
  name: string;
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

/**
 * `<MealExample>` renders a worked example — the description someone typed and
 * the breakdown Kallo produced. That is a table, and a table is the one shape
 * that survives the trip into a model's context intact.
 */
function mealExampleToMarkdown(block: string): string[] {
  const input = stringProp(block, 'input') ?? '';
  const totalLabel = stringProp(block, 'totalLabel') ?? 'Total';

  const dishes: Dish[] = [];
  const dishPattern =
    /\{\s*name:\s*'([^']*)',\s*protein:\s*(-?[\d.]+),\s*carbs:\s*(-?[\d.]+),\s*fat:\s*(-?[\d.]+),\s*calories:\s*(-?[\d.]+)\s*,?\s*\}/g;
  for (const match of block.matchAll(dishPattern)) {
    dishes.push({
      name: match[1],
      protein: Number(match[2]),
      carbs: Number(match[3]),
      fat: Number(match[4]),
      calories: Number(match[5]),
    });
  }

  const lines = [
    `> Example — described as: "${input}"`,
    '',
    '| Dish | Protein | Carbs | Fat | Calories |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const dish of dishes) {
    lines.push(
      `| ${dish.name} | ${dish.protein}g | ${dish.carbs}g | ${dish.fat}g | ${dish.calories} kcal |`
    );
  }
  if (dishes.length > 0) {
    const sum = (pick: (d: Dish) => number) =>
      dishes.reduce((total, dish) => total + pick(dish), 0);
    lines.push(
      `| **${totalLabel}** | **${sum((d) => d.protein)}g** | **${sum((d) => d.carbs)}g** | **${sum((d) => d.fat)}g** | **${sum((d) => d.calories)} kcal** |`
    );
  }
  return lines;
}

interface TransformState {
  /** Depth of the open `<Steps>` block, and the counter it is numbering. */
  stepIndex: number | null;
  inCallout: boolean;
}

/**
 * The frontmatter fields, read from the source rather than the compiled module.
 *
 * `loadFrontmatter` gets the same three values by importing the `.mdx`, which
 * pulls the MDX compiler and a React component in to read three strings. Here
 * the file has already been read, and every docs frontmatter is plain
 * `key: value` lines — `navigation.test.ts` and the corpus test in
 * `render.test.ts` hold that true.
 */
export interface ParsedFrontmatter {
  title: string;
  description: string;
  lastUpdated: string;
}

const FRONTMATTER_LINE = /^([a-zA-Z]+):\s*(.+)$/;

export function parseFrontmatter(source: string): ParsedFrontmatter | null {
  const lines = source.split('\n');
  if (lines[0]?.trim() !== '---') return null;

  const fields: Record<string, string> = {};
  for (const line of lines.slice(1)) {
    if (line.trim() === '---') break;
    const match = FRONTMATTER_LINE.exec(line);
    if (!match) continue;
    // Values are optionally quoted — `lastUpdated: '2026-08-03'` is, the prose
    // fields are not.
    fields[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }

  const { title, description, lastUpdated } = fields;
  if (!(title && description && lastUpdated)) return null;
  return { title, description, lastUpdated };
}

/**
 * Strip YAML frontmatter, returning the remaining body.
 *
 * Frontmatter is only frontmatter when the fence opens on line 1 — the same
 * rule `toc.ts` applies, so the two cannot disagree about where a body starts.
 */
export function stripFrontmatter(source: string): string {
  const lines = source.split('\n');
  if (lines[0]?.trim() !== '---') return source;

  const end = lines.findIndex(
    (line, index) => index > 0 && line.trim() === '---'
  );
  return end === -1 ? source : lines.slice(end + 1).join('\n');
}

/**
 * Rewrite the docs' root-relative links (`/docs/…`) to absolute, locale-correct
 * URLs. A markdown file has no base URL, so a relative link in it is a dead
 * end for anything that fetched it out of band.
 */
export function absolutiseLinks(
  body: string,
  { siteUrl, locale }: { siteUrl: string; locale: string }
): string {
  return body.replace(
    /\]\((\/(?!\/)[^)\s]*)\)/g,
    (_full, href: string) => `](${siteUrl}/${locale}${href})`
  );
}

/** Convert the four MDX components to Markdown, leaving prose alone. */
export function stripComponents(body: string): string {
  const lines = body.split('\n');
  const out: string[] = [];
  const state: TransformState = { stepIndex: null, inCallout: false };
  let inFence = false;
  let mealBuffer: string[] | null = null;

  for (const line of lines) {
    // Fenced code is verbatim: a `<Callout` inside an example must survive.
    if (FENCE.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }

    if (mealBuffer !== null) {
      mealBuffer.push(line);
      if (line.trim().endsWith('/>')) {
        out.push(...mealExampleToMarkdown(mealBuffer.join('\n')));
        mealBuffer = null;
      }
      continue;
    }

    const trimmed = line.trim();

    if (trimmed.startsWith('<MealExample')) {
      mealBuffer = [line];
      if (trimmed.endsWith('/>')) {
        out.push(...mealExampleToMarkdown(line));
        mealBuffer = null;
      }
      continue;
    }

    if (trimmed.startsWith('<Callout')) {
      const label = stringProp(trimmed, 'label');
      state.inCallout = true;
      out.push(label ? `> **${label}**` : '> **Note**');
      out.push('>');
      continue;
    }
    if (trimmed === '</Callout>') {
      state.inCallout = false;
      out.push('');
      continue;
    }
    if (state.inCallout) {
      out.push(trimmed === '' ? '>' : `> ${line}`);
      continue;
    }

    if (trimmed === '<Steps>') {
      state.stepIndex = 0;
      continue;
    }
    if (trimmed === '</Steps>') {
      state.stepIndex = null;
      continue;
    }
    if (trimmed.startsWith('<Step ')) {
      state.stepIndex = (state.stepIndex ?? 0) + 1;
      const title = stringProp(trimmed, 'title');
      out.push(`${state.stepIndex}. **${title ?? `Step ${state.stepIndex}`}**`);
      out.push('');
      continue;
    }
    if (trimmed === '</Step>') {
      out.push('');
      continue;
    }

    out.push(line);
  }

  // Collapse the blank-line runs the component removal leaves behind.
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
