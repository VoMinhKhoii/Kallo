import { cn } from '@/lib/core/ui/cn';

/** The page's one heading style: Lora, with the turn of the line underlined. */
export function SectionTitle({
  id,
  lead,
  rest,
  oneLine = false,
  underlined = true,
  className,
}: {
  id: string;
  lead: string;
  rest?: string;
  oneLine?: boolean;
  underlined?: boolean;
  className?: string;
}) {
  const line = oneLine ? 'inline' : 'block';

  return (
    <h2
      id={id}
      className={cn(
        'font-medium font-serif text-4xl text-kallo-text leading-[1.04] tracking-[-0.03em] sm:text-5xl md:text-6xl',
        className
      )}
    >
      <span className={line}>{lead}</span>
      {rest ? (
        <>
          {' '}
          <span
            className={cn(
              line,
              underlined &&
                'underline decoration-[0.055em] underline-offset-[0.16em]'
            )}
          >
            {rest}
          </span>
        </>
      ) : null}
    </h2>
  );
}
