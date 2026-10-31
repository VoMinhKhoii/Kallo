'use client';

import { useSearchParams } from 'next/navigation';
import type { MouseEvent } from 'react';
import { isPlainLeftClick } from '@/lib/core/ui/plain-click';
import {
  parseSettingsPage,
  SETTINGS_PARAM,
  type SettingsPageId,
} from '@/lib/domain/settings/pages';

// Whether the history entry showing the dialog is one `open` pushed. Closing
// then steps back to the page underneath, so Back after a close never reopens
// the dialog. Module-level because the opener (sidebar, menu) and the dialog
// are different components with their own hook calls.
let openedByPush = false;

function writeParam(value: string | null, mode: 'push' | 'replace') {
  const url = new URL(window.location.href);
  if (value === null) url.searchParams.delete(SETTINGS_PARAM);
  else url.searchParams.set(SETTINGS_PARAM, value);
  // Native history calls sync with useSearchParams without a server round
  // trip, so switching pages never re-renders the page behind the dialog.
  if (mode === 'push') window.history.pushState(null, '', url);
  else window.history.replaceState(null, '', url);
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
      openedByPush = true;
      writeParam(page ?? '', 'push');
    },
    /** Switches page in place; page switches do not stack history. */
    show(page: SettingsPageId | null) {
      writeParam(page ?? '', 'replace');
    },
    close() {
      if (openedByPush) {
        openedByPush = false;
        window.history.back();
      } else {
        writeParam(null, 'replace');
      }
    },
  };
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
      onOpen?.();
      open();
    },
  };
}
