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
import { DOCS_SECTIONS } from '@/lib/docs/navigation';
import type { DocsSearchEntry } from '@/lib/docs/search-index';

/**
 * ⌘K / Ctrl-K search over the docs.
 *
 * The trigger is a real button that looks like a field rather than an actual
 * input: the palette owns the text entry, and a second focusable input in the
 * header would put a dead tab stop in front of every reader.
 */
export function DocsSearch({ entries }: { entries: DocsSearchEntry[] }) {
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
        className="flex h-9 items-center gap-2 rounded-lg border border-nham-border bg-white px-3 text-nham-text-muted transition-colors hover:bg-nham-hover hover:text-nham-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent"
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
                    keywords={entry.keywords}
                    onSelect={() => go(entry.slug)}
                    value={`${entry.title} ${entry.description}`}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-base text-nham-text">
                        {entry.title}
                      </p>
                      <p className="truncate text-caption text-nham-text-muted">
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
