interface SectionHeaderProps {
  title: string;
  description?: string;
}

/**
 * The heading that opens each settings dialog page — a sans title (Lora is
 * kept for the dialog's own "Settings" title) and an optional muted
 * description — so every page shares one header idiom.
 */
export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="mb-5">
      <h2 className="font-semibold text-[22px] text-kallo-text leading-tight tracking-tight">
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-[14px] text-kallo-text-muted">{description}</p>
      )}
    </div>
  );
}
