// ---------------------------------------------------------------------------
// Objectionable-text filter for user-generated circle content (App Store 1.2)
// ---------------------------------------------------------------------------
// Applied on every UGC write that other people read: share replies, chat
// messages, chat group names (create + rename) and circle display names /
// handles. A hit is a 422 `objectionable_content` — the client keeps the draft
// and asks the person to edit it.
//
// Matching is whole-word / whole-phrase over tokens, never substrings, so
// "Scunthorpe", "therapist" and "cocktail" pass. Normalisation is NFC +
// lowercase only: Vietnamese diacritics are meaningful (bò = beef, bưởi =
// pomelo) and are NEVER stripped. This is a first line, not the moderation
// system — reports (POST /api/v1/reports) and blocks carry the rest.

import { Errors } from '@/lib/core/errors/catalog';
import { OBJECTIONABLE_TERMS } from './objectionable-terms';

/** Letters (with any combining marks) and digits form words; everything else
 * — spaces, punctuation, apostrophes, emoji — separates them. */
const SEPARATOR = /[^\p{L}\p{M}\p{N}]+/u;

const OBJECTIONABLE_CONTENT_MESSAGE =
  'Nội dung có từ ngữ không phù hợp. Vui lòng sửa lại rồi thử lại.';

function tokenize(text: string): string[] {
  return text
    .normalize('NFC')
    .toLowerCase()
    .normalize('NFC')
    .split(SEPARATOR)
    .filter(Boolean);
}

/** Each term pre-tokenised once, by the same rule the input goes through. */
const TERMS = OBJECTIONABLE_TERMS.map((term) => ({
  term,
  tokens: tokenize(term),
})).filter(({ tokens }) => tokens.length > 0);

function containsSequence(
  haystack: readonly string[],
  needle: readonly string[]
): boolean {
  for (let start = 0; start + needle.length <= haystack.length; start++) {
    let matched = true;
    for (let offset = 0; offset < needle.length; offset++) {
      if (haystack[start + offset] !== needle[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

/** The first listed term `text` contains as a whole word or phrase, or null. */
export function findObjectionableTerm(text: string): string | null {
  const tokens = tokenize(text);
  if (tokens.length === 0) return null;
  const hit = TERMS.find((entry) => containsSequence(tokens, entry.tokens));
  return hit?.term ?? null;
}

/**
 * Throw a 422 `objectionable_content` when any of `texts` contains a listed
 * term. Null / undefined entries (an optional field left out) are skipped.
 * The matched term is never echoed back to the client.
 */
export function assertAcceptableText(
  ...texts: ReadonlyArray<string | null | undefined>
): void {
  for (const text of texts) {
    if (text && findObjectionableTerm(text) !== null) {
      throw Errors.objectionableContent(OBJECTIONABLE_CONTENT_MESSAGE);
    }
  }
}
