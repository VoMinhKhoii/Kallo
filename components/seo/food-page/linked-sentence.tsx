import { DocsLink, DocsParagraph } from '@/components/docs/mdx/prose';

interface LinkedSentenceProps {
  before: string;
  link: string;
  after: string;
  href: string;
}

/**
 * A paragraph with one link inside it: the words before, the linked words and
 * the words after, each from the page's copy so the link sits where the
 * language puts it.
 */
export function LinkedSentence({
  before,
  link,
  after,
  href,
}: LinkedSentenceProps) {
  return (
    <DocsParagraph>
      {before}
      <DocsLink href={href}>{link}</DocsLink>
      {after}
    </DocsParagraph>
  );
}
