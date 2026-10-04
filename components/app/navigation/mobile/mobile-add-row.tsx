import { ChevronRight, type LucideIcon } from 'lucide-react';

/** One 64px Add-sheet action row (Flutter's `ListRow`): glyph, label over a
 *  muted hint, and a chevron. */
export function MobileAddRow({
  icon: Icon,
  label,
  hint,
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="flex min-h-16 w-full items-center gap-3 py-2 text-left transition-colors active:bg-kallo-hover"
      >
        <Icon
          className="size-6 shrink-0 text-kallo-text"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium text-[16px] text-kallo-text">
            {label}
          </span>
          <span className="truncate text-[14px] text-kallo-text-muted">
            {hint}
          </span>
        </span>
        <ChevronRight
          className="size-4 shrink-0 text-kallo-text-muted"
          aria-hidden="true"
        />
      </button>
    </li>
  );
}
