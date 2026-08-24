import { describe, expect, it } from 'vitest';
import {
  absolutiseLinks,
  stripComponents,
  stripFrontmatter,
} from '@/lib/domain/docs/markdown/to-markdown';

describe('stripFrontmatter', () => {
  it('removes a leading YAML block', () => {
    const source = [
      '---',
      'title: A',
      'description: B',
      '---',
      '',
      'Body.',
    ].join('\n');
    expect(stripFrontmatter(source).trim()).toBe('Body.');
  });

  it('leaves a document with no frontmatter alone', () => {
    expect(stripFrontmatter('Just prose.')).toBe('Just prose.');
  });

  it('only treats a fence on line 1 as frontmatter', () => {
    // A `---` further down is a horizontal rule, and eating everything above it
    // would silently delete the top of the page.
    const source = 'Intro.\n\n---\n\nMore.';
    expect(stripFrontmatter(source)).toBe(source);
  });
});

describe('absolutiseLinks', () => {
  const opts = { siteUrl: 'https://kallo.fit', locale: 'en' };

  it('makes root-relative links absolute and locale-correct', () => {
    expect(absolutiseLinks('See [manual](/docs/logging/manual).', opts)).toBe(
      'See [manual](https://kallo.fit/en/docs/logging/manual).'
    );
  });

  it('leaves absolute links alone', () => {
    const line = 'See [spec](https://kallo.fit/openapi.json).';
    expect(absolutiseLinks(line, opts)).toBe(line);
  });

  it('leaves protocol-relative and mailto links alone', () => {
    const line =
      'Write to [us](mailto:support@kallo.fit) or [x](//example.com).';
    expect(absolutiseLinks(line, opts)).toBe(line);
  });

  it('uses the locale it was given', () => {
    expect(
      absolutiseLinks('[a](/docs/overview)', { ...opts, locale: 'vi' })
    ).toBe('[a](https://kallo.fit/vi/docs/overview)');
  });
});

describe('stripComponents', () => {
  it('turns a Callout into a labelled blockquote', () => {
    const out = stripComponents(
      [
        '<Callout label="Watch out" tone="caution">',
        'Be careful.',
        '</Callout>',
      ].join('\n')
    );
    expect(out).toBe('> **Watch out**\n>\n> Be careful.');
  });

  it('falls back to a generic label when the Callout has none', () => {
    const out = stripComponents('<Callout>\nText.\n</Callout>');
    expect(out).toBe('> **Note**\n>\n> Text.');
  });

  it('turns Steps into an ordered list', () => {
    const out = stripComponents(
      [
        '<Steps>',
        '<Step index={1} title="Open Logging">',
        'Pick Logging.',
        '</Step>',
        '<Step index={2} title="Describe the meal">',
        'Type it.',
        '</Step>',
        '</Steps>',
      ].join('\n')
    );
    expect(out).toContain('1. **Open Logging**');
    expect(out).toContain('Pick Logging.');
    expect(out).toContain('2. **Describe the meal**');
    expect(out).not.toContain('<Step');
  });

  it('turns a MealExample into a table with totals', () => {
    const out = stripComponents(
      [
        '<MealExample',
        '  input="chicken caesar salad and an iced latte"',
        '  totalLabel="Total"',
        '  dishes={[',
        "    { name: 'Chicken caesar salad', protein: 34, carbs: 18, fat: 26, calories: 450 },",
        "    { name: 'Iced latte', protein: 6, carbs: 12, fat: 5, calories: 125 },",
        '  ]}',
        '/>',
      ].join('\n')
    );
    expect(out).toContain('chicken caesar salad and an iced latte');
    expect(out).toContain(
      '| Chicken caesar salad | 34g | 18g | 26g | 450 kcal |'
    );
    expect(out).toContain('| Iced latte | 6g | 12g | 5g | 125 kcal |');
    // 34+6, 18+12, 26+5, 450+125 — the row a reader would otherwise add up.
    expect(out).toContain(
      '| **Total** | **40g** | **30g** | **31g** | **575 kcal** |'
    );
  });

  it('leaves ordinary Markdown untouched', () => {
    const source = '## Heading\n\nSome **bold** text and a [link](/docs/a).';
    expect(stripComponents(source)).toBe(source);
  });

  it('does not touch component-looking text inside a fenced block', () => {
    // A docs page that shows the MDX source of a Callout must survive intact.
    const source = [
      '```mdx',
      '<Callout label="x">',
      'y',
      '</Callout>',
      '```',
    ].join('\n');
    expect(stripComponents(source)).toBe(source);
  });

  it('collapses the blank runs component removal leaves behind', () => {
    const out = stripComponents('A.\n\n<Steps>\n\n</Steps>\n\nB.');
    expect(out).not.toMatch(/\n{3,}/);
  });
});
