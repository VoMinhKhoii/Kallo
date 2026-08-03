// Picked dishes live as TEXT inside the composer, tinted blue, rather than as
// chips somewhere else. A textarea cannot colour part of its value, so the
// colour comes from a mirror element painted behind a transparent-text
// textarea (see mention-overlay.tsx) — which means the source of truth for
// "where is each mention" is a set of offsets into the textarea's own value,
// reconciled on every keystroke.
//
// Pure module: no DOM, no React. Everything here is offset arithmetic.
import type { RelogStagedEntry, SlashToken } from '@/lib/logging/relog/relog';

/** A staged pick plus where its label currently sits in the composer text. */
export interface RelogMention extends RelogStagedEntry {
  /** Index of the label's first character in the textarea value. */
  start: number;
}

/**
 * Re-locate every mention after the text changed.
 *
 * Walks the mentions in order, claiming the next occurrence of each label at or
 * after the previous one ended. A mention whose label no longer appears has
 * been edited or deleted by the user, so it is DROPPED — and with it the
 * reference, which is what stops a half-deleted name from still logging a dish.
 *
 * Scanning forward from a running cursor (rather than searching the whole
 * string each time) is what keeps duplicate picks of the same dish distinct:
 * two "Cà phê sữa đá" mentions claim the first and second occurrence
 * respectively, instead of both collapsing onto the first.
 */
export function reconcileMentions(
  value: string,
  mentions: RelogMention[]
): RelogMention[] {
  const surviving: RelogMention[] = [];
  let cursor = 0;
  for (const mention of mentions) {
    const index = value.indexOf(mention.label, cursor);
    if (index === -1) continue;
    surviving.push({ ...mention, start: index });
    cursor = index + mention.label.length;
  }
  return surviving;
}

/**
 * Replace the `/`-token with the picked label. Returns the new value, where the
 * caret should land, and the mention's offset.
 *
 * A trailing space is appended so the user can keep typing (or pick again)
 * without having to add one — and so two adjacent mentions never fuse into a
 * single unbroken run of text.
 */
export function insertMention(
  value: string,
  token: SlashToken,
  label: string
): { value: string; caret: number; start: number } {
  const before = value.slice(0, token.start);
  const after = value.slice(token.end);
  // Don't double up if the text already continues with a space.
  const separator = after.startsWith(' ') ? '' : ' ';
  return {
    value: `${before}${label}${separator}${after}`,
    caret: token.start + label.length + separator.length,
    start: token.start,
  };
}

/**
 * Remove every mention's text, leaving whatever the user typed around them.
 *
 * Applied after a successful submit: the mentions have been logged, so their
 * text has served its purpose, but free text the user typed alongside is theirs
 * and must survive (the same non-destructive rule the staged-list version had).
 * Removal runs right-to-left so earlier offsets stay valid.
 */
export function stripMentions(value: string, mentions: RelogMention[]): string {
  let out = value;
  for (const mention of [...mentions].sort((a, b) => b.start - a.start)) {
    out =
      out.slice(0, mention.start) +
      out.slice(mention.start + mention.label.length);
    out = collapseSeam(out, mention.start);
  }
  return out.trim();
}

const isSpaceOrTab = (char: string | undefined) =>
  char === ' ' || char === '\t';

/**
 * Collapse the whitespace run that a removal just joined at `index` down to a
 * single space.
 *
 * Only at the SEAM. Collapsing the whole value (what this used to do) rewrites
 * any surviving mention whose label contains a double space — and a `meal`
 * candidate's label is `raw_input`, i.e. free user text, so that is reachable.
 * `reconcileMentions` would then fail to find that label and silently drop its
 * reference, leaving the user a staged row for a dish that will never be
 * logged.
 */
function collapseSeam(value: string, index: number): string {
  let start = index;
  while (start > 0 && isSpaceOrTab(value[start - 1])) start--;
  let end = index;
  while (end < value.length && isSpaceOrTab(value[end])) end++;
  if (end === start) return value;
  // A single space is always safe here; the caller's trim() removes it when the
  // seam sits at either boundary.
  return `${value.slice(0, start)} ${value.slice(end)}`;
}

export interface MentionSegment {
  text: string;
  isMention: boolean;
}

/** Split the value into alternating plain/mention runs for the mirror to
 *  paint. Concatenating every `text` reproduces `value` exactly — the overlay
 *  depends on that to stay glyph-aligned with the textarea. */
export function buildMentionSegments(
  value: string,
  mentions: RelogMention[]
): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let pos = 0;
  for (const mention of mentions) {
    if (mention.start < pos) continue;
    if (mention.start > pos) {
      segments.push({
        text: value.slice(pos, mention.start),
        isMention: false,
      });
    }
    const end = mention.start + mention.label.length;
    segments.push({ text: value.slice(mention.start, end), isMention: true });
    pos = end;
  }
  if (pos < value.length) {
    segments.push({ text: value.slice(pos), isMention: false });
  }
  return segments;
}
