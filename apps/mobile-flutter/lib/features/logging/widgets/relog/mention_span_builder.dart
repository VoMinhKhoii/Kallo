import 'package:flutter/material.dart';

import '../../../../theme/kallo_colors.dart';
import '../../logic/relog/mentions.dart';

/// How the composer's value is PAINTED, split from what the value contains.
///
/// The controller owns the mention state machine — where each pick sits, which
/// ones survived an edit. This owns the one question that state answers for the
/// field: which runs get the blue.
///
/// Returns null when the caller should fall through to the framework's own
/// span, which is the right answer twice: with no picks there is nothing to
/// tint, and inside a composing region that OVERLAPS a pick the IME's underline
/// and our tint would fight over the same glyphs. Only an overlap, though —
/// bailing on any composing region at all would strobe the colour, because
/// Vietnamese IMEs compose per syllable and would drop it on nearly every
/// keystroke.
TextSpan? buildMentionTextSpan({
  required String text,
  required TextEditingValue value,
  required List<RelogMention> mentions,
  required TextStyle? style,
  required bool withComposing,
}) {
  if (mentions.isEmpty) return null;

  final composing = value.composing;
  final overlapsPick =
      withComposing &&
      value.isComposingRangeValid &&
      !composing.isCollapsed &&
      mentions.any((m) => composing.start < m.end && m.start < composing.end);
  if (overlapsPick) return null;

  // Blue ink, nothing else. A pick is a lightweight token in the sentence — no
  // fill, no chip, no macros — so the only thing marking it as a reference
  // rather than prose is the colour.
  final mentionStyle = (style ?? const TextStyle()).copyWith(
    color: KalloColors.mention,
  );
  return TextSpan(
    style: style,
    children: [
      for (final segment in buildMentionSegments(text, mentions))
        TextSpan(
          text: segment.text,
          style: segment.isMention ? mentionStyle : null,
        ),
    ],
  );
}
