interface SectionHeaderProps {
  title: string;
  description?: string;
}

/**
 * The heading that opens each settings dialog page — Lora serif title (never
 * bold), optional muted description — so every page shares one header idiom.
 */
export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="mb-5">
      <h2 className="font-normal font-serif text-[28px] text-kallo-text leading-tight tracking-tight md:text-[26px]">
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-[14px] text-kallo-text-muted">{description}</p>
      )}
    </div>
  );
}
