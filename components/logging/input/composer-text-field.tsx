'use client';

import { type RefObject, useRef } from 'react';
import { MentionOverlay } from '@/components/logging/input/relog/mention-overlay';
import type { MentionSegment } from '@/lib/logging/relog/mentions';
import { cn } from '@/lib/utils';

interface ComposerTextFieldProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  defaultValue: string;
  placeholder: string;
  disabled?: boolean;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Fired whenever the value or caret may have moved. */
  onSync?: () => void;
  /** Coloured runs painted behind the text. Non-empty hands the glyphs to the
   *  mirror; see MentionOverlay for why that indirection exists. */
  mentionSegments?: MentionSegment[];
  isPopupOpen?: boolean;
  popupListboxId?: string;
  popupActiveDescendantId?: string;
}

/**
 * The composer's text field: an uncontrolled textarea plus the mirror that
 * tints picked dishes.
 *
 * Split out of MealInput so that file stays about composer orchestration
 * (modes, drafts, submit) rather than also owning the mention-overlay
 * plumbing.
 */
export function ComposerTextField({
  textareaRef,
  defaultValue,
  placeholder,
  disabled,
  onChange,
  onKeyDown,
  onSync,
  mentionSegments,
  isPopupOpen,
  popupListboxId,
  popupActiveDescendantId,
}: ComposerTextFieldProps) {
  const mirrorRef = useRef<HTMLDivElement>(null);
  const hasMentions = (mentionSegments?.length ?? 0) > 0;

  return (
    <div className="relative min-w-0 flex-1">
      {hasMentions && (
        <MentionOverlay
          segments={mentionSegments ?? []}
          mirrorRef={mirrorRef}
        />
      )}
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: the combobox
          aria-* below are gated on the same `isPopupOpen` as role="combobox",
          which the rule cannot see statically. The invalid pairing (combobox
          aria on a plain textarea) never actually renders. This is the
          standard ARIA "mention" pattern: a combobox in a free-text field. */}
      <textarea
        ref={textareaRef}
        id="meal-input"
        rows={1}
        defaultValue={defaultValue}
        onChange={onChange}
        onKeyDown={onKeyDown}
        // The caret can move without the value changing (arrows, clicks), and
        // an overlay keyed off the caret has to see that.
        onKeyUp={onSync}
        onClick={onSync}
        // Past the 200px cap the textarea scrolls itself; the mirror has to
        // follow or the painted text slides out of register.
        onScroll={(e) => {
          if (mirrorRef.current) {
            mirrorRef.current.scrollTop = e.currentTarget.scrollTop;
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        // Combobox semantics only WHILE a popup is open: announcing the
        // composer as a combobox permanently would mislabel its primary use,
        // which is free-text meal entry.
        role={isPopupOpen ? 'combobox' : undefined}
        aria-expanded={isPopupOpen ? true : undefined}
        aria-controls={isPopupOpen ? popupListboxId : undefined}
        aria-autocomplete={isPopupOpen ? 'list' : undefined}
        aria-activedescendant={
          isPopupOpen ? popupActiveDescendantId : undefined
        }
        className={cn(
          'relative w-full resize-none bg-transparent py-1.5 font-[var(--font-dm-sans)] font-normal text-sm leading-5 placeholder:text-nham-text-muted/40 focus:outline-none disabled:opacity-50',
          // Hand the glyphs to the mirror, but keep the real caret and the
          // selection highlight on the textarea itself.
          hasMentions
            ? 'text-transparent caret-nham-text selection:bg-nham-accent/30'
            : 'text-nham-text'
        )}
      />
    </div>
  );
}
