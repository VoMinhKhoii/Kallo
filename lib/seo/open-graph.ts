/**
 * The OpenGraph fields every page shares.
 *
 * Next merges `metadata` **shallowly**: a page that declares `openGraph` at all
 * replaces the layout's object outright rather than extending it. So a page
 * setting nothing but `openGraph.url` silently drops the image, the site name
 * and the type — the page still renders `og:title` and `og:description`,
 * because Next backfills those two from the resolved `title`/`description`,
 * which is exactly what makes the loss easy to miss. Every docs page shipped
 * without a preview image this way.
 *
 * Spreading this constant into any page-level `openGraph` is what prevents it.
 *
 * `siteName` is the bare brand rather than `metadata.root.title`: that title
 * carries a click-through pitch, which belongs in a search result and not on
 * the line of a link preview that says where the link goes.
 */
export const SHARED_OPEN_GRAPH = {
  type: 'website' as const,
  siteName: 'Kallo',
  images: [{ url: '/og-image.png', width: 1200, height: 630 }],
};
