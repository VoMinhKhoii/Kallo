'use client';

import { ArrowUp, UtensilsCrossed } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { SidebarTooltip } from './sidebar-tooltip';

// Mirrors the logging empty-state chips so the rail composer and the feed offer
// the same first prompts.
const SUGGESTIONS = ['2 mực kho + cơm', 'Phở bò tái', 'Bún chả Hà Nội'];

function isTypingTarget(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  );
}

/**
 * The daily verb, given a permanent home in the desktop frame. A primary
 * "Log a meal" pill at the top of the rail (icon-only when collapsed) plus the
 * global `L` / `⌘J` shortcut open a centered composer on the canonical scrim.
 * Submitting hands the text to the logging surface (where the streaming analysis
 * lives) via the existing `?meal=` round-trip.
 */
export function GlobalComposer({ collapsed }: { collapsed: boolean }) {
  const t = useTranslations('app.mainSidebar');
  const tl = useTranslations('logging');
  const tm = useTranslations('dashboard.mealTrigger');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  // `L` (when not already typing) and ⌘/Ctrl+J summon the composer from anywhere
  // in the app shell.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const cmdJ =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j';
      const bareL =
        event.key.toLowerCase() === 'l' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey;
      if (!cmdJ && !bareL) return;
      if (bareL && isTypingTarget(document.activeElement)) return;
      event.preventDefault();
      setOpen(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const submit = (meal: string) => {
    const trimmed = meal.trim();
    if (!trimmed) return;
    setOpen(false);
    setText('');
    router.push(`/logging?meal=${encodeURIComponent(trimmed)}`);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit(text);
  };

  return (
    <>
      <SidebarTooltip enabled={collapsed} label={t('logMeal')}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('logMeal')}
          aria-keyshortcuts="L Meta+J"
          className={cn(
            'group/log flex items-center rounded-lg bg-nham-btn py-2 font-medium font-sans-display text-[13px] text-white shadow-nham-btn/20 shadow-sm transition-colors hover:bg-nham-btn-hover',
            collapsed ? 'justify-center px-0' : 'px-3'
          )}
        >
          <span
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center',
              collapsed ? 'mx-auto' : ''
            )}
          >
            <UtensilsCrossed className="h-5 w-5" />
          </span>
          <span
            className={cn(
              'overflow-hidden whitespace-nowrap tracking-tight transition-all duration-300',
              collapsed ? 'ml-0 max-w-0 opacity-0' : 'ml-3 max-w-40 opacity-100'
            )}
          >
            {t('logMeal')}
          </span>
        </button>
      </SidebarTooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[28%] max-w-lg translate-y-0 gap-4 border-nham-border/60 bg-nham-surface p-6 sm:p-7">
          <DialogTitle
            className="font-normal text-[22px] text-nham-text tracking-tight"
            style={{ fontFamily: 'Lora, serif' }}
          >
            {t('composerTitle')}
          </DialogTitle>
          <form
            onSubmit={handleSubmit}
            className="flex min-w-0 items-center gap-2 rounded-2xl border border-nham-border/70 bg-card px-3 transition-colors focus-within:border-nham-accent/50"
          >
            <label htmlFor="global-composer-input" className="sr-only">
              {tl('placeholder')}
            </label>
            <input
              id="global-composer-input"
              type="text"
              placeholder={tl('placeholder')}
              maxLength={300}
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="h-12 min-w-0 flex-1 bg-transparent text-nham-text text-sm outline-none placeholder:text-nham-stone"
            />
            <button
              type="submit"
              aria-label={tm('send')}
              disabled={text.trim().length === 0}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-nham-btn text-white transition-colors hover:bg-nham-btn-hover disabled:bg-nham-track disabled:text-nham-stone"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </form>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((suggestion) => (
              <button
                type="button"
                key={suggestion}
                onClick={() => submit(suggestion)}
                className="rounded-full border border-nham-border/60 bg-white/80 px-3 py-1 font-medium text-nham-text-muted text-xs transition-colors hover:border-nham-accent/50 hover:bg-nham-border/15"
                style={{ fontFamily: 'DM Sans, sans-serif' }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
