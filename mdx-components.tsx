import type { MDXComponents } from 'mdx/types';
import { Callout } from '@/components/docs/mdx/callout';
import { MealExample } from '@/components/docs/mdx/meal-example';
import {
  DocsBlockquote,
  DocsH2,
  DocsH3,
  DocsHr,
  DocsLink,
  DocsListItem,
  DocsOrderedList,
  DocsParagraph,
  DocsStrong,
  DocsUnorderedList,
} from '@/components/docs/mdx/prose';
import {
  DocsInlineCode,
  DocsPre,
  DocsTable,
  DocsTd,
  DocsTh,
} from '@/components/docs/mdx/prose-blocks';
import { Step, Steps } from '@/components/docs/mdx/steps';

/**
 * Required by `@next/mdx` — the element map every `.mdx` under /content
 * renders through.
 *
 * `h1` is intentionally absent: the page title comes from frontmatter and is
 * rendered once by the route, so document bodies start at `h2`. That keeps a
 * single h1 per page and keeps the "on this page" rail (h2/h3) honest.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h2: DocsH2,
    h3: DocsH3,
    p: DocsParagraph,
    a: DocsLink,
    ul: DocsUnorderedList,
    ol: DocsOrderedList,
    li: DocsListItem,
    strong: DocsStrong,
    blockquote: DocsBlockquote,
    hr: DocsHr,
    code: DocsInlineCode,
    pre: DocsPre,
    table: DocsTable,
    th: DocsTh,
    td: DocsTd,
    // Components MDX files use by name.
    Callout,
    MealExample,
    Step,
    Steps,
    ...components,
  };
}
