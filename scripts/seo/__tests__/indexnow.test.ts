import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INDEXNOW_KEY, indexNowPayload, sitemapUrls } from '../indexnow';

describe('IndexNow', () => {
  it('ships the key file the engines fetch to prove ownership', () => {
    // The engines GET `/<key>.txt` and compare its body to the submitted key.
    // A key without its file makes every submission fail verification.
    const file = join(process.cwd(), 'public', `${INDEXNOW_KEY}.txt`);
    expect(readFileSync(file, 'utf8').trim()).toBe(INDEXNOW_KEY);
  });

  it('submits for the canonical host, pointing at the key file', () => {
    expect(indexNowPayload(['https://kallo.fit/en'])).toEqual({
      host: 'kallo.fit',
      key: INDEXNOW_KEY,
      keyLocation: `https://kallo.fit/${INDEXNOW_KEY}.txt`,
      urlList: ['https://kallo.fit/en'],
    });
  });

  it('reads each page from the sitemap once, not its hreflang alternates', () => {
    const xml = `<urlset>
      <url><loc>https://kallo.fit/en</loc>
        <xhtml:link rel="alternate" hreflang="vi" href="https://kallo.fit/vi" /></url>
      <url><loc>https://kallo.fit/vi</loc></url>
      <url><loc>https://kallo.fit/en</loc></url>
    </urlset>`;
    expect(sitemapUrls(xml)).toEqual([
      'https://kallo.fit/en',
      'https://kallo.fit/vi',
    ]);
  });
});
