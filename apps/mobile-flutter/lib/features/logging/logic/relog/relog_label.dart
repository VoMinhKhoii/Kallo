/// The card label for a submit that carried relog picks.
///
/// Ported from `buildRelogRawInput` in `lib/logging/relog/relog.ts`, and it has
/// to STAY a port: `meals.raw_input` is what the persisted card shows, and for a
/// combined submit the server writes `[free text, ...dish names]`
/// (`app/api/analyze-meal/route.ts`). Deriving the same string client-side is
/// what stops the card's own label from changing under the user the moment they
/// confirm it.
library;

import '../../../../models/relog.dart';
import 'slash_token.dart';

/// Mirrors `RELOG_RAW_INPUT_MAX`. The column is bounded server-side, so a label
/// built here has to truncate identically or a long combined meal would render
/// one string and persist another.
const int kRelogRawInputMax = 500;

/// Join [labels] into a card label, truncating to [kRelogRawInputMax].
String buildRelogRawInput(List<String> labels) {
  final joined = labels.join(', ');
  if (joined.length <= kRelogRawInputMax) return joined;
  return '${joined.substring(0, kRelogRawInputMax - 1)}…';
}

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

/// The label for a combined submit: the typed text, then every pick.
///
/// Returns [freeText] untouched when there are no picks, so the ordinary
/// text-only path keeps rendering exactly what was typed.
String combinedRelogLabel(String freeText, List<String> pickNames) {
  if (pickNames.isEmpty) return freeText;
  return buildRelogRawInput([
    if (freeText.isNotEmpty) freeText,
    ...pickNames,
  ]);
}
