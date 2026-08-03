/**
 * Augments the `*.mdx` module type from `@types/mdx` with the named export
 * that `remark-mdx-frontmatter` generates (configured as `frontmatter` in
 * next.config.ts). Without this, `loadDoc()` cannot see the export at all.
 *
 * This must stay a script file — no top-level `import`/`export` — or the
 * `declare module` stops being a global augmentation. Imports go inside the
 * block, as the @types/mdx README prescribes.
 */
declare module '*.mdx' {
  import type { ComponentType } from 'react';

  export const frontmatter: {
    title: string;
    description: string;
    lastUpdated: string;
  };

  const MDXComponent: ComponentType<Record<string, unknown>>;
  export default MDXComponent;
}
