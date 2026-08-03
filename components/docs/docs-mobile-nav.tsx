'use client';

import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { DocsSidebar } from '@/components/docs/docs-sidebar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { DocsNavSection } from '@/lib/docs/tree';

/**
 * The sidebar as a left drawer below the `lg` breakpoint, where the
 * three-column grid collapses to one.
 *
 * Following a link closes the drawer — without that the sheet stays open over
 * the page the reader just asked for, which reads as a broken tap.
 */
export function DocsMobileNav({ sections }: { sections: DocsNavSection[] }) {
  const t = useTranslations('docs.menu');
  const [open, setOpen] = useState(false);

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger
        aria-label={t('open')}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-nham-border bg-white text-nham-text-muted transition-colors hover:bg-nham-hover hover:text-nham-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nham-accent lg:hidden"
      >
        <Menu className="h-4 w-4" />
      </SheetTrigger>
      <SheetContent
        className="w-[19rem] overflow-y-auto bg-nham-surface px-4 py-6"
        side="left"
      >
        <SheetHeader className="p-0">
          <SheetTitle className="px-3 text-left font-normal font-serif text-base text-nham-text">
            {t('label')}
          </SheetTitle>
        </SheetHeader>
        <DocsSidebar onNavigate={() => setOpen(false)} sections={sections} />
      </SheetContent>
    </Sheet>
  );
}
