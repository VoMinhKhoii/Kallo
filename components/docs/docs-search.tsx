'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useRouter } from '@/i18n/navigation';
import { DOCS_SECTIONS } from '@/lib/domain/docs/navigation';
import type { DocsSearchEntry } from '@/lib/domain/docs/search-index';

/**
 * Strips Vietnamese diacritics so `dinh duong` finds `Dinh dưỡng`.
 *
 * Typing accents needs a Vietnamese keyboard or a fair amount of patience, so
 * an accent-sensitive palette is unusable for exactly the readers this product
 * is built for. NFD splits a letter from its marks, the range strip removes
 * them, and đ/Đ is handled separately because it is a distinct letter rather
 * than a base plus a combining mark.
 */
function foldDiacritics(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/**
 * cmdk searches an item's `value` plus its `keywords`, so the unaccented forms
 * ride along as extra keywords rather than replacing the filter. That keeps
 * `components/ui/command` untouched — `CommandDialog` does not forward a
 * `filter` prop to the inner `Command`, and the shadcn primitives are
 * generated files.
 */
function searchKeywords(entry: DocsSearchEntry): string[] {
  return [
    ...entry.keywords,
    foldDiacritics(entry.title),
    foldDiacritics(entry.description),
    ...entry.keywords.map(foldDiacritics),
  ];
}

/**
 * ⌘K / Ctrl-K search over the docs.
 *
 * The trigger is a real button that looks like a field rather than an actual
 * input: the palette owns the text entry, and a second focusable input in the
 * header would put a dead tab stop in front of every reader.
 */
interface DocsSearchProps {
  entries: DocsSearchEntry[];
}

export function DocsSearch({ entries }: DocsSearchProps) {
  const t = useTranslations('docs.search');
  const tSections = useTranslations('docs.sections');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // `CommandDialog` renders its sr-only title (an `h2`) beside the dialog, not
  // inside it, so it is in the page whether or not the palette is open, ahead of
  // the article's `h1`. Mounting the palette on first use keeps it out of the
  // server HTML; after that it stays mounted so the close animation still runs.
  const [used, setUsed] = useState(false);
  if (open && !used) setUsed(true);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const go = useCallback(
    (slug: string) => {
      setOpen(false);
      router.push(`/docs/${slug}`);
    },
    [router]
  );

  return (
    <>
      {/* A filled field one tone below the page, no outline: it sits in the
          header beside the landing's plain locale switch and black CTA, and
          shares the CTA's height and radius. The shortcut is plain text, not
          a boxed key. */}
      <button
        className="flex h-9 items-center gap-2 rounded-xl bg-kallo-segment px-3 font-sans-display text-kallo-text-muted text-sm transition-colors hover:bg-kallo-border hover:text-kallo-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent sm:w-56 sm:px-3.5"
        aria-label={t('trigger')}
        onClick={() => setOpen(true)}
        type="button"
      >
        <Search aria-hidden className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">{t('trigger')}</span>
        <span
          aria-hidden
          className="ml-auto hidden text-kallo-text-muted/80 tabular-nums sm:inline"
        >
          ⌘K
        </span>
      </button>

      {used && (
        <CommandDialog
          description={t('label')}
          onOpenChange={setOpen}
          open={open}
          title={t('label')}
        >
          <CommandInput placeholder={t('placeholder')} />
          <CommandList>
            <CommandEmpty>{t('empty')}</CommandEmpty>
            {DOCS_SECTIONS.map((section) => {
              const rows = entries.filter(
                (entry) => entry.sectionId === section.id
              );
              if (rows.length === 0) return null;

              return (
                <CommandGroup heading={tSections(section.id)} key={section.id}>
                  {rows.map((entry) => (
                    <CommandItem
                      key={entry.slug}
                      keywords={searchKeywords(entry)}
                      onSelect={() => go(entry.slug)}
                      value={`${entry.title} ${entry.description}`}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-base text-kallo-text">
                          {entry.title}
                        </p>
                        <p className="truncate text-caption text-kallo-text-muted">
                          {entry.description}
                        </p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </CommandDialog>
      )}
    </>
  );
}
