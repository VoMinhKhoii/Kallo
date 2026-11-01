import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DocsFooter } from '@/components/docs/docs-footer';

const sections = [
  { id: 'start', links: [{ slug: 'overview', title: 'Overview' }] },
  {
    id: 'logging',
    links: [
      { slug: 'logging/describe-a-meal', title: 'Describe a meal' },
      { slug: 'logging/barcode', title: 'Barcode' },
    ],
  },
];

describe('DocsFooter', () => {
  it('renders no headings: a page outline starts at its h1', async () => {
    // The footer is ahead of the article in the streamed HTML, so group labels
    // rendered as `h2` put nine headings in front of the page's `h1`.
    render(await DocsFooter({ sections }));

    expect(screen.queryAllByRole('heading')).toHaveLength(0);
  });

  it('still names each group of links for assistive tech', async () => {
    render(await DocsFooter({ sections }));

    // The test setup renders message keys as-is, so the label is the key.
    const logging = screen.getByRole('list', { name: 'logging' });
    expect(within(logging).getAllByRole('link')).toHaveLength(2);
    expect(screen.getByRole('list', { name: 'start' })).toBeInTheDocument();
  });

  it('links the food pages on English pages', async () => {
    // The setup's locale is `en`; the pages exist in English only.
    render(await DocsFooter({ sections }));

    expect(
      screen.getByRole('link', { name: 'Calories in meals' })
    ).toHaveAttribute('href', '/calories');
  });
});
