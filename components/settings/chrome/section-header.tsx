interface SectionHeaderProps {
  title: string;
  description?: string;
}

/**
 * The heading block that sits above each settings section — Lora serif title
 * (never bold), optional muted description. Extracted from the settings page so
 * every section shares one header idiom.
 */
export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="mb-4">
      <h2 className="font-normal font-serif text-kallo-text text-xl">
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-[14px] text-kallo-text-muted">{description}</p>
      )}
    </div>
  );
}
