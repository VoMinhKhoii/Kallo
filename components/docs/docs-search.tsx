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
import { Kbd } from '@/components/ui/kbd';
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
      <button
        className="flex h-9 items-center gap-2 rounded-lg border border-kallo-border bg-white px-3 text-kallo-text-muted transition-colors hover:bg-kallo-hover hover:text-kallo-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kallo-accent"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden font-sans-display text-caption sm:inline">
          {t('trigger')}
        </span>
        <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
      </button>

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
    </>
  );
}
