interface SectionHeaderProps {
  title: string;
}

/**
 * The heading that opens each settings dialog page: a sans title alone (Lora
 * is kept for the dialog's own "Settings" title). Its 22px/snug line matches
 * the rail title's, so the two sit on one line across the dialog.
 */
export function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <h2 className="mb-6 font-semibold text-[22px] text-kallo-text leading-snug tracking-tight">
      {title}
    </h2>
  );
}
