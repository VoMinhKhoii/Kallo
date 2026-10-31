'use client';

import { useSearchParams } from 'next/navigation';
import type { MouseEvent } from 'react';
import {
  parseSettingsPage,
  SETTINGS_PARAM,
  type SettingsPageId,
} from '@/lib/domain/settings/pages';
import { rememberSettingsOpener } from './use-return-focus';

// Marks a history entry `open` pushed. Closing from such an entry steps back
// to the page underneath, so Back after a close never reopens the dialog. Kept
// on the entry itself, not in memory: an entry replaced since (a language
// switch inside the dialog) loses the mark, and closing then just drops the
// param instead of stepping back to the old URL.
const PUSHED_MARK = 'kalloSettingsPushed';

function isPushedEntry(): boolean {
  return window.history.state?.[PUSHED_MARK] === true;
}

function writeParam(value: string | null, mode: 'push' | 'replace') {
  const url = new URL(window.location.href);
  if (value === null) url.searchParams.delete(SETTINGS_PARAM);
  else url.searchParams.set(SETTINGS_PARAM, value);
  // Native history calls sync with useSearchParams without a server round
  // trip, so switching pages never re-renders the page behind the dialog.
  // Always a fresh state object: Next copies its own keys in, but passes a
  // state that already has them straight through without syncing the URL.
  if (mode === 'push') {
    window.history.pushState({ [PUSHED_MARK]: true }, '', url);
  } else {
    window.history.replaceState({ [PUSHED_MARK]: isPushedEntry() }, '', url);
  }
}

/**
 * The settings dialog's state, kept in the URL (`?settings=<page>`) so Back
 * closes it, a reload keeps it, and old `/settings` links can redirect into
 * it. `page` is null when the dialog shows no particular page: the default
 * page on desktop, the page list on phones.
 */
export function useSettingsDialog() {
  // Null outside an App Router tree (component tests render the nav alone).
  const raw = useSearchParams()?.get(SETTINGS_PARAM) ?? null;

  return {
    isOpen: raw !== null,
    page: parseSettingsPage(raw),
    open(page?: SettingsPageId) {
      writeParam(page ?? '', 'push');
    },
    /** Switches page in place; page switches do not stack history. */
    show(page: SettingsPageId | null) {
      writeParam(page ?? '', 'replace');
    },
    close() {
      if (isPushedEntry()) {
        window.history.back();
      } else {
        writeParam(null, 'replace');
      }
    },
  };
}

// An ordinary left click. A cmd/ctrl/shift/middle click falls through to the
// browser, which opens the link's href in a new tab.
function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

/**
 * Props for a link that opens the dialog in place on a plain click. A
 * cmd/ctrl/middle click still follows `/settings`, which redirects into the
 * dialog in the new tab. `onOpen` runs first (e.g. to close a menu sheet).
 */
export function useSettingsLink(onOpen?: () => void) {
  const { isOpen, open } = useSettingsDialog();

  return {
    isOpen,
    href: '/settings',
    onClick(event: MouseEvent<HTMLAnchorElement>) {
      if (!isPlainLeftClick(event)) return;
      event.preventDefault();
      rememberSettingsOpener(event.currentTarget);
      onOpen?.();
      open();
    },
  };
}
