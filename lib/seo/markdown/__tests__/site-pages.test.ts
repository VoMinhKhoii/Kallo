import { describe, expect, it } from 'vitest';
import { renderSitePageMarkdown } from '@/lib/seo/markdown/site-pages';

// Translations are mocked to their keys in the global setup, so words that
// come from messages show up as keys here; the copy files' words are real.

async function render(locale: 'en' | 'vi', path: string): Promise<string> {
  const body = await renderSitePageMarkdown(locale, path);
  if (body === null) throw new Error(`no page at ${locale}${path}`);
  return body;
}

describe('renderSitePageMarkdown', () => {
  it('carries a food page: the summary table, each meal and its total', async () => {
    const body = await render('en', '/calories/chicken-burrito');
    expect(body).toMatch(
      /^\| Meal \| Calories \| Protein \| Carbs \| Fat \|$/m
    );
    expect(body.match(/^### /gm)?.length).toBeGreaterThanOrEqual(4);
    // The meal card's `total`, as its key.
    expect(body).toMatch(/\| \*\*total\*\* \| \d+ kcal \| \d+g \|/);
    expect(body).toContain('https://kallo.fit/en/data/meal-calorie-variation');
  });

  it('writes a Vietnamese food page in Vietnamese', async () => {
    const body = await render('vi', '/calories/pho-bo');
    expect(body).toMatch(/^\| Bữa \| Calo \| Đạm \| Tinh bột \| Chất béo \|$/m);
    expect(body).not.toContain('**Total**');
  });

  it('lists the web plans and the new-account offer on pricing', async () => {
    const body = await render('en', '/pricing');
    for (const key of ['plans.free.name', 'plans.premium.name', 'offerNote']) {
      expect(body).toContain(key);
    }
    // Lifetime cannot be bought on the web, and the page does not show it.
    expect(body).not.toContain('lifetime');
    expect(body).toContain('https://kallo.fit/en/docs/account/premium');
  });

  it('resolves Kallo’s own sources on an alternatives page to full URLs', async () => {
    const body = await render('en', '/alternatives/cal-ai');
    expect(body).toContain(
      'https://kallo.fit/en/docs/estimates/accuracy-and-limits'
    );
    expect(body).not.toMatch(/\]\(\//);
  });

  it('answers null for a path that is no page', async () => {
    expect(await renderSitePageMarkdown('en', '/calories/pho-bo')).toBeNull();
    expect(
      await renderSitePageMarkdown('vi', '/compare/kallo-vs-cal-ai')
    ).toBeNull();
  });
});
