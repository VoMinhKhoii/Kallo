import type { HeatmapMonthHeader } from '@/lib/types/dashboard';

/** A month must own at least this many week columns to be worth labelling. */
const MIN_LABEL_COLUMNS = 2;

/**
 * Resolve the server's month headers into non-overlapping grid placements.
 *
 * The headers are *not* safe to place blindly: a Monday-anchored week column
 * straddles the month boundary, so a 1–2 day sliver month shares its
 * `startColumn` with the next month — both land in the same grid cell and
 * paint on top of each other (the "Apr"/"May" overlap). Walking them in
 * calendar order, each header is pushed past the columns the previous label
 * already claimed, and anything left too narrow to read is dropped.
 */
export function layoutMonthHeaders(
  headers: HeatmapMonthHeader[]
): HeatmapMonthHeader[] {
  const placed: HeatmapMonthHeader[] = [];
  let freeColumn = 0;

  for (const header of headers) {
    const startColumn = Math.max(header.startColumn, freeColumn);
    const span = header.startColumn + header.span - startColumn;
    if (span < MIN_LABEL_COLUMNS) continue;
    placed.push({ month: header.month, startColumn, span });
    freeColumn = startColumn + span;
  }

  return placed;
}

/**
 * Row 1 of the heatmap grid — month names over the week columns they span.
 * Rendered as a fragment so each label stays a direct grid child.
 */
export function HeatmapMonthHeaderRow({
  headers,
}: {
  headers: HeatmapMonthHeader[];
}) {
  return (
    <>
      {layoutMonthHeaders(headers).map((header) => (
        <div
          className="truncate pb-1 font-medium text-nham-text-muted text-xs"
          key={`${header.month}-${header.startColumn}`}
          style={{
            gridRow: 1,
            gridColumn: `${header.startColumn + 2} / span ${header.span}`,
          }}
        >
          {header.month}
        </div>
      ))}
    </>
  );
}
