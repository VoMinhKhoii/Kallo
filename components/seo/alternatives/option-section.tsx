import {
  DocsH2,
  DocsLink,
  DocsListItem,
  DocsParagraph,
  DocsStrong,
  DocsUnorderedList,
} from '@/components/docs/mdx/prose';
import { ALTERNATIVES_CHROME } from '@/lib/seo/alternatives/chrome';
import type { AlternativeOption, Source } from '@/lib/seo/alternatives/types';

/** "Sources: A, B" with each source linked. */
export function SourceLine({ sources }: { sources: Source[] }) {
  return (
    <p className="mt-4 text-kallo-text-muted text-sm leading-[1.75]">
      {ALTERNATIVES_CHROME.labels.sources}:{' '}
      {sources.map((source, i) => (
        <span key={source.url}>
          {i > 0 ? ', ' : null}
          <DocsLink href={source.url}>{source.label}</DocsLink>
        </span>
      ))}
    </p>
  );
}

/** One app: what it is, the facts in a short list, its drawback, its sources. */
export function OptionSection({ option }: { option: AlternativeOption }) {
  const labels = ALTERNATIVES_CHROME.labels;
  const facts: [string, string][] = [
    [labels.logs, option.logs],
    [labels.free, option.free],
    [labels.paid, option.paid],
    [labels.platforms, option.platforms],
    [labels.bestFor, option.bestFor],
    [labels.drawback, option.drawback],
  ];
  return (
    <section>
      <DocsH2>
        {option.name}: {option.headline}
        {option.ours ? ` (${labels.ours})` : null}
      </DocsH2>
      {option.body.map((paragraph) => (
        <DocsParagraph key={paragraph.slice(0, 40)}>{paragraph}</DocsParagraph>
      ))}
      <DocsUnorderedList>
        {facts.map(([label, value]) => (
          <DocsListItem key={label}>
            <DocsStrong>{label}:</DocsStrong> {value}
          </DocsListItem>
        ))}
      </DocsUnorderedList>
      <SourceLine sources={option.sources} />
    </section>
  );
}
