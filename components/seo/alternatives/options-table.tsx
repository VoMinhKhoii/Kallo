import { DocsTable, DocsTd, DocsTh } from '@/components/docs/mdx/prose-blocks';
import { ALTERNATIVES_CHROME } from '@/lib/seo/alternatives/chrome';
import type { AlternativeOption } from '@/lib/seo/alternatives/types';

const HEAD = 'px-2 sm:px-4';
const CELL =
  'px-2 text-sm last:border-b sm:px-4 sm:text-base [tr:last-child_&]:border-0';
// Kallo's row carries the same warm wash as the Premium card on /pricing.
const OURS = 'bg-kallo-gold-wash';

/**
 * Every app on one table, one row each, above the write-ups. Four columns fit a
 * phone without scrolling. A real `<table>` is what search engines and
 * assistants lift into an answer.
 */
export function OptionsTable({ options }: { options: AlternativeOption[] }) {
  const { tableHeads: heads, labels } = ALTERNATIVES_CHROME;
  return (
    <DocsTable>
      <thead>
        <tr>
          <DocsTh className={HEAD}>{heads.app}</DocsTh>
          <DocsTh className={HEAD}>{heads.logs}</DocsTh>
          <DocsTh className={HEAD}>{heads.free}</DocsTh>
          <DocsTh className={HEAD}>{heads.paid}</DocsTh>
        </tr>
      </thead>
      <tbody>
        {options.map((option) => (
          <tr className={option.ours ? OURS : undefined} key={option.name}>
            <DocsTd className={`${CELL} font-semibold`}>
              {option.name}
              {option.ours ? (
                <span className="block font-normal text-kallo-text-muted text-xs">
                  {labels.ours}
                </span>
              ) : null}
            </DocsTd>
            <DocsTd className={CELL}>{option.logs}</DocsTd>
            <DocsTd className={CELL}>{option.free}</DocsTd>
            <DocsTd className={CELL}>{option.paid}</DocsTd>
          </tr>
        ))}
      </tbody>
    </DocsTable>
  );
}
