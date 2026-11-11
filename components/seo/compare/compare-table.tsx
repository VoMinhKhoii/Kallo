import { DocsTable, DocsTd, DocsTh } from '@/components/docs/mdx/prose-blocks';
import { ALTERNATIVES_CHROME } from '@/lib/seo/alternatives/chrome';
import type { ComparePage } from '@/lib/seo/compare/types';

// Same widths as the alternatives table, so three columns fit a 390px phone.
const HEAD = 'px-1.5 sm:px-4';
const CELL =
  'px-1.5 text-sm last:border-b sm:px-4 sm:text-base [tr:last-child_&]:border-0';
// Kallo's column carries the gold wash its row has on the alternatives table.
const OURS = 'bg-kallo-gold-wash';

/** Kallo and the other app side by side, one row per fact. */
export function CompareTable({ page }: { page: ComparePage }) {
  return (
    <DocsTable>
      <thead>
        <tr>
          <DocsTh className={HEAD}>
            <span className="sr-only">
              {ALTERNATIVES_CHROME.tableHeads.app}
            </span>
          </DocsTh>
          <DocsTh className={`${HEAD} ${OURS}`} scope="col">
            Kallo
            <span className="block font-normal text-kallo-text-muted text-xs">
              {ALTERNATIVES_CHROME.labels.ours}
            </span>
          </DocsTh>
          <DocsTh className={HEAD} scope="col">
            {page.them}
          </DocsTh>
        </tr>
      </thead>
      <tbody>
        {page.rows.map((row) => (
          <tr key={row.label}>
            <DocsTd className={`${CELL} font-semibold`}>{row.label}</DocsTd>
            <DocsTd className={`${CELL} ${OURS}`}>{row.kallo}</DocsTd>
            <DocsTd className={CELL}>{row.them}</DocsTd>
          </tr>
        ))}
      </tbody>
    </DocsTable>
  );
}
