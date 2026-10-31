'use client';

import { useRef } from 'react';

/**
 * What should get focus back. Settings usually opens from an item in a menu
 * or sheet that closes as the dialog opens, so prefer the control that
 * opened that popup (the one whose `aria-controls` names it).
 */
function openerOf(active: Element | null): HTMLElement | null {
  if (!(active instanceof HTMLElement) || active === document.body) {
    return null;
  }
  const popup = active.closest('[role="menu"], [role="dialog"]');
  if (popup?.id) {
    const control = document.querySelector(
      `[aria-controls="${CSS.escape(popup.id)}"]`
    );
    if (control instanceof HTMLElement) return control;
  }
  return active;
}

// Set by the link that opens Settings, at its click: the menu or sheet it
// sits in is still mounted then, but closes before the dialog takes focus.
let clickedOpener: HTMLElement | null = null;

/** Called by the settings link as it opens the dialog. */
export function rememberSettingsOpener(clicked: Element) {
  clickedOpener = openerOf(clicked);
}

/**
 * Focus handling for the settings dialog, which has no Radix Trigger (it
 * opens from the URL): on open, remember what held focus and focus the
 * dialog itself, not its first control (a deep link's first rail item would
 * wear a ring it has no claim to); on close, hand focus back to what held
 * it, if it is still on the page.
 */
export function useReturnFocus() {
  const opener = useRef<HTMLElement | null>(null);

  return {
    onOpenAutoFocus(event: Event) {
      opener.current = clickedOpener ?? openerOf(document.activeElement);
      clickedOpener = null;
      event.preventDefault();
      (event.currentTarget as HTMLElement).focus();
    },
    onCloseAutoFocus(event: Event) {
      event.preventDefault();
      const target = opener.current;
      opener.current = null;
      if (target?.isConnected) target.focus();
    },
  };
}
