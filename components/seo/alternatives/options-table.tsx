import { DocsTable, DocsTd, DocsTh } from '@/components/docs/mdx/prose-blocks';
import type { AlternativePage } from '@/lib/seo/alternatives/types';

const HEAD = 'px-2 sm:px-4';
const CELL =
  'px-2 text-sm last:border-b sm:px-4 sm:text-base [tr:last-child_&]:border-0';

/**
 * Every app on one table, above the write-ups. A real `<table>` is what search
 * engines and assistants lift into an answer; it scrolls inside its own box on
 * a phone.
 */
export function OptionsTable({ page }: { page: AlternativePage }) {
  const heads = page.tableHeads;
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
        {page.options.map((option) => (
          <tr key={option.name}>
            <DocsTd className={`${CELL} font-semibold`}>{option.name}</DocsTd>
            <DocsTd className={CELL}>{option.logs}</DocsTd>
            <DocsTd className={CELL}>{option.free}</DocsTd>
            <DocsTd className={CELL}>{option.paid}</DocsTd>
          </tr>
        ))}
      </tbody>
    </DocsTable>
  );
}
