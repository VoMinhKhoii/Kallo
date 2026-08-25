import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { parseFrontmatter } from '@/lib/domain/docs/markdown/to-markdown';
import { DOCS_SLUGS } from '@/lib/domain/docs/navigation';

// The route reads frontmatter through the loader, which imports the compiled
// `.mdx` — and vitest has no MDX pipeline. Read the same frontmatter off the
// same files instead, so the assertions below run against the real titles and
// descriptions rather than fixtures.
vi.mock('@/lib/domain/docs/loader', () => ({
  loadFrontmatter: (locale: string, slug: string) => {
    const file = path.join(
      process.cwd(),
      'content',
      'docs',
      locale,
      `${slug}.mdx`
    );
    return Promise.resolve(parseFrontmatter(readFileSync(file, 'utf8')));
  },
}));

const { GET } = await import('@/app/llms.txt/route');
const body = await (await GET()).text();

describe('/llms.txt', () => {
  it('is served as plain text', async () => {
    const response = await GET();
    expect(response.headers.get('Content-Type')).toBe(
      'text/plain; charset=utf-8'
    );
  });

  it('opens in the llmstxt.org shape: an h1 then a blockquote summary', () => {
    const lines = body.split('\n');
    expect(lines[0]).toBe('# Kallo');
    expect(body).toMatch(/\n> .+/);
  });

  it('links every documentation page', () => {
    // Built from DOCS_SECTIONS, the same source the sidebar and sitemap read,
    // so a new page cannot appear in the nav and be missing here.
    for (const slug of DOCS_SLUGS) {
      expect(body, slug).toContain(`https://kallo.fit/en/docs/${slug}`);
    }
  });

  it('tells an agent when Kallo is the right tool', () => {
    // Generic marketing copy does not read as guidance. These are the specific
    // jobs, and the named non-goals.
    expect(body).toContain('## When to use Kallo');
    expect(body).toContain('portion');
    expect(body).toContain('Vietnamese');
    expect(body).toMatch(/Do not use Kallo for medical/);
  });

  it('names the machine entry points and how auth actually works', () => {
    expect(body).toContain('## For agents');
    expect(body).toContain('https://kallo.fit/openapi.json');
    expect(body).toContain(
      'https://kallo.fit/.well-known/oauth-protected-resource'
    );
    expect(body).toContain('Accept: text/markdown');
    expect(body).toContain('https://kallo.fit/sitemap.xml');
    // The scope warning is the one thing an agent holding a token must know.
    expect(body).toContain('no scopes');
  });

  it('links the Vietnamese tree', () => {
    expect(body).toContain('https://kallo.fit/vi');
  });
});
