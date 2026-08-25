import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import NotFound, { metadata } from '../not-found';

// `useTranslations` is stubbed globally to echo its key, so the assertions
// below are on which strings the page asks for, not on the copy itself.

describe('the 404 page', () => {
  it('is not indexable, but its links are followable', () => {
    // `follow: true` is the point: do not index this page, but do follow the
    // recovery links off it.
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.title).toContain('404');
  });

  it('still says what happened', () => {
    render(<NotFound />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('404');
    expect(screen.getByText('notFound')).toBeTruthy();
    expect(screen.getByText('notFoundBody')).toBeTruthy();
  });

  it('offers a route back into the site', () => {
    // The regression this closes: the page used to be the number and one line
    // of text — a dead end for a reader and for a crawler.
    render(<NotFound />);
    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    expect(hrefs).toContain('/');
    expect(hrefs).toContain('/docs/overview');
    expect(hrefs).toContain('/docs/company/contact');
  });

  it('offers the machine-readable indexes an agent recovers from', () => {
    render(<NotFound />);
    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    expect(hrefs).toContain('https://kallo.fit/llms.txt');
    expect(hrefs).toContain('https://kallo.fit/sitemap.xml');
    expect(hrefs).toContain('https://kallo.fit/openapi.json');
  });

  it('groups the links under a heading rather than leaving them loose', () => {
    render(<NotFound />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
      'notFoundWhereToLook'
    );
  });
});
