import { DocsTable, DocsTd, DocsTh } from '@/components/docs/mdx/prose-blocks';
import { ALTERNATIVES_CHROME } from '@/lib/seo/alternatives/chrome';
import type { AlternativeOption } from '@/lib/seo/alternatives/types';

const ROWS = ['logs', 'free', 'paid'] as const;

// Each row is ruled but the last. `DocsTd` drops the rule on a row's last
// cell, which here is the last app, so the cells set it back.
const RULE =
  'border-kallo-border/60 border-b last:border-b [tr:last-child_&]:border-0';
// The row labels stay put while the apps scroll sideways under them; the
// background matches the table's so scrolled text does not show through.
const LABEL = `sticky left-0 z-10 min-w-[7.5rem] bg-white px-3 py-3 text-left align-top font-semibold text-kallo-text text-sm sm:px-4 sm:text-base ${RULE}`;
const CELL = `min-w-[9.5rem] px-3 text-sm sm:px-4 sm:text-base ${RULE}`;

/**
 * Every app side by side, one column each, above the write-ups. A real
 * `<table>` is what search engines and assistants lift into an answer. Seven
 * columns are wider than the article, so the table scrolls inside its own box
 * with the row labels pinned on the left.
 */
export function OptionsTable({ options }: { options: AlternativeOption[] }) {
  const heads = ALTERNATIVES_CHROME.tableHeads;
  return (
    <DocsTable>
      <thead>
        <tr>
          <DocsTh className="sticky left-0 z-10 bg-white px-3 sm:px-4">
            <span className="sr-only">{heads.app}</span>
          </DocsTh>
          {options.map((option) => (
            <DocsTh className="px-3 sm:px-4" key={option.name} scope="col">
              {option.name}
            </DocsTh>
          ))}
        </tr>
      </thead>
      <tbody>
        {ROWS.map((row) => (
          <tr key={row}>
            <th className={LABEL} scope="row">
              {heads[row]}
            </th>
            {options.map((option) => (
              <DocsTd className={CELL} key={option.name}>
                {option[row]}
              </DocsTd>
            ))}
          </tr>
        ))}
      </tbody>
    </DocsTable>
  );
}
