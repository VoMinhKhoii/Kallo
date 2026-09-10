/// Turning the composer's `/`-marked sentence back into ordinary prose.
///
/// The card a submit produces shows the user their OWN words. It does not
/// rebuild a label out of parts: joining `[free text, ...pick names]` reorders
/// the sentence whenever a pick did not come last, so "/1 cơm gà… + 1 kem
/// vani" came back as "+ 1 kem vani, 1 cơm gà…". Stripping the markers in
/// place preserves the order for free — and the result rides the submit as
/// `displayText`, so `meals.raw_input` is this string rather than the join.
library;

import '../../../../models/logging/relog.dart';
import 'slash_token.dart';

/// A pick's name without the `/` it was summoned with.
///
/// Exact for a DISH: the server resolves that ref to a row whose name is this
/// string. Approximate for a MEAL, which the server expands into its dishes and
/// labels with each dish's name — so the optimistic label reads
/// "phở bò với trà đá" where the persisted one reads "Phở bò, Trà đá". Showing
/// the user's own words until the real card arrives beats showing neither.
String relogPickName(RelogStagedEntry entry) =>
    entry.label.startsWith(mentionPrefix)
        ? entry.label.substring(mentionPrefix.length)
        : entry.label;

/// Strip the `/` marker off every pick's label in [text], leaving the names as
/// ordinary prose.
///
/// For a submit that cannot carry references — cheat mode — where the marker
/// would otherwise reach the model as literal text. The sentence the user is
/// looking at survives unchanged apart from the token syntax, so nothing they
/// can see is silently dropped; only the deterministic copy is, which that mode
/// never supported.
String unmarkPicks(String text, List<RelogStagedEntry> staged) {
  var out = text;
  for (final entry in staged) {
    if (!entry.label.startsWith(mentionPrefix)) continue;
    out = out.replaceAll(entry.label, relogPickName(entry));
  }
  return out;
}

/// The server's cap on `displayText` (`DISPLAY_TEXT_MAX_LENGTH`). Roomier than
/// a meal description because the composer sentence is that description with
/// up to 20 pick labels still IN it.
const int kMaxDisplayTextChars = 2000;

/// Cut [text] to the cap the server enforces.
///
/// Past it the submit is REJECTED, not shortened: a sentence one character too
/// long would lose the whole meal rather than its tail. The server truncates
/// what it stores to 500 anyway, so nothing a user can read is lost here.
String capDisplayText(String text) {
  if (text.length <= kMaxDisplayTextChars) return text;
  final cut = text.substring(0, kMaxDisplayTextChars);
  // Never end on half a character: cutting between a surrogate pair leaves a
  // lone code unit, which is not valid text to send anywhere.
  final last = cut.codeUnitAt(cut.length - 1);
  final orphaned = last >= 0xD800 && last <= 0xDBFF;
  return orphaned ? cut.substring(0, cut.length - 1) : cut;
}
