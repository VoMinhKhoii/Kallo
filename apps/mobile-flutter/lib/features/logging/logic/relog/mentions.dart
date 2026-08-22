/// Picked dishes live as TEXT inside the composer, tinted, rather than as chips
/// somewhere else. The source of truth for "where is each mention" is a set of
/// offsets into the field's own value, reconciled on every keystroke.
///
/// Ported from `lib/logging/relog/mentions.ts`. Pure offset arithmetic — no
/// widgets, no controllers. Dart string indices are UTF-16 code units, the same
/// unit JavaScript uses, so the offsets transfer exactly.
library;

import '../../../../models/logging/relog.dart';
import 'slash_token.dart';

/// A composer value plus the picks located inside it, captured before a submit
/// clears the field so a failed run can hand both back.
///
/// The mentions cannot be recovered from the text alone — clearing the field
/// drops them — so a combined submit snapshots the pair.
class MentionSnapshot {
  final String text;
  final List<RelogMention> mentions;

  const MentionSnapshot({required this.text, required this.mentions});
}

/// A staged pick plus where its label currently sits in the composer text.
class RelogMention extends RelogStagedEntry {
  /// Index of the label's first character in the field value.
  final int start;

  const RelogMention({
    required super.stageId,
    required super.ref,
    required super.label,
    required this.start,
  });

  RelogMention.at(RelogStagedEntry entry, this.start)
    : super(stageId: entry.stageId, ref: entry.ref, label: entry.label);

  RelogMention movedTo(int newStart) => RelogMention.at(this, newStart);

  /// Exclusive end of the mention's run in the composer text.
  int get end => start + label.length;
}

/// True when [offset] falls inside one of [mentions]' committed runs.
///
/// A pick keeps the `/` it was summoned with, and `parseSlashToken` claims the
/// last `/` left of the caret — so a caret resting after `/Phở bò ` reports
/// that pick's own slash as a live token. Acting on it re-opens the picker on
/// the dish just chosen, and accepting anything would rewrite the committed
/// label, dropping the reference it stood for.
bool isInsideMention(int offset, List<RelogMention> mentions) =>
    mentions.any((m) => offset >= m.start && offset < m.end);

/// Re-locate every mention after the text changed.
///
/// Walks the mentions in order, claiming the next occurrence of each label at
/// or after the previous one ended. A mention whose label no longer appears has
/// been edited or deleted by the user, so it is DROPPED — and with it the
/// reference, which is what stops a half-deleted name from still logging a
/// dish.
///
/// Scanning forward from a running cursor (rather than searching the whole
/// string each time) is what keeps duplicate picks of the same dish distinct:
/// two "Cà phê sữa đá" mentions claim the first and second occurrence
/// respectively, instead of both collapsing onto the first.
///
/// That cursor makes the walk ORDER-DEPENDENT, so the sort below is load-
/// bearing, not tidiness: handed a pick that sits earlier in the sentence than
/// one already in the list, an unsorted walk runs the cursor past it and drops
/// it — the reference vanishes while its `/label` stays in the text and reaches
/// the AI as prose. Owning the ordering HERE rather than at each call site is
/// what stops that being re-introduced by the next caller.
///
/// The sort is STABLE (Dart's `List.sort` is not, hence the decorate step), so
/// a newly inserted pick that ties with the mention it displaced keeps the
/// caller's intended precedence.
List<RelogMention> reconcileMentions(
  String value,
  List<RelogMention> mentions,
) {
  final indexed = [
    for (var i = 0; i < mentions.length; i++) (i, mentions[i]),
  ]..sort((a, b) {
    final byStart = a.$2.start.compareTo(b.$2.start);
    return byStart != 0 ? byStart : a.$1.compareTo(b.$1);
  });

  final surviving = <RelogMention>[];
  var cursor = 0;
  for (final (_, mention) in indexed) {
    if (mention.label.isEmpty) continue;
    final index = value.indexOf(mention.label, cursor);
    if (index == -1) continue;
    surviving.add(mention.movedTo(index));
    cursor = index + mention.label.length;
  }
  return surviving;
}

/// Replace the `/`-token with the picked label.
///
/// A trailing space is appended so the user can keep typing (or pick again)
/// without having to add one — and so two adjacent mentions never fuse into a
/// single unbroken run of text.
({String value, int caret, int start}) insertMention(
  String value,
  SlashToken token,
  String label,
) {
  final before = value.substring(0, token.start);
  final after = value.substring(token.end);
  // Don't double up if the text already continues with a space.
  final separator = after.startsWith(' ') ? '' : ' ';
  return (
    value: '$before$label$separator$after',
    caret: token.start + label.length + separator.length,
    start: token.start,
  );
}

/// Remove every mention's text, leaving whatever the user typed around them.
///
/// Applied after a successful submit: the mentions have been logged, so their
/// text has served its purpose, but free text the user typed alongside is
/// theirs and must survive. Removal runs right-to-left so earlier offsets stay
/// valid.
String stripMentions(String value, List<RelogMention> mentions) {
  final ordered = [...mentions]..sort((a, b) => b.start.compareTo(a.start));
  var out = value;
  for (final mention in ordered) {
    if (mention.start < 0 || mention.end > out.length) continue;
    out = out.substring(0, mention.start) + out.substring(mention.end);
    out = _collapseSeam(out, mention.start);
  }
  return out.trim();
}

bool _isSpaceOrTab(String char) => char == ' ' || char == '\t';

/// Collapse the whitespace run that a removal just joined at [index] down to a
/// single space.
///
/// Only at the SEAM. Collapsing the whole value (what this used to do) rewrites
/// any surviving mention whose label contains a double space — and a `meal`
/// candidate's label is `raw_input`, i.e. free user text, so that is reachable.
/// [reconcileMentions] would then fail to find that label and silently drop its
/// reference, leaving the user a staged row for a dish that will never be
/// logged.
String _collapseSeam(String value, int index) {
  var start = index;
  while (start > 0 && _isSpaceOrTab(value[start - 1])) {
    start--;
  }
  var end = index;
  while (end < value.length && _isSpaceOrTab(value[end])) {
    end++;
  }
  if (end == start) return value;
  // A single space is always safe here; the caller's trim() removes it when the
  // seam sits at either boundary.
  return '${value.substring(0, start)} ${value.substring(end)}';
}

/// One run of the composer text, either plain or part of a mention.
class MentionSegment {
  final String text;
  final bool isMention;

  const MentionSegment({required this.text, required this.isMention});

  @override
  bool operator ==(Object other) =>
      other is MentionSegment &&
      other.text == text &&
      other.isMention == isMention;

  @override
  int get hashCode => Object.hash(text, isMention);

  @override
  String toString() => 'MentionSegment("$text", isMention: $isMention)';
}

/// Split the value into alternating plain/mention runs for the field to paint.
/// Concatenating every [MentionSegment.text] reproduces [value] exactly — the
/// rendered spans depend on that to stay aligned with the real caret.
List<MentionSegment> buildMentionSegments(
  String value,
  List<RelogMention> mentions,
) {
  final segments = <MentionSegment>[];
  var pos = 0;
  for (final mention in mentions) {
    if (mention.start < pos || mention.end > value.length) continue;
    if (mention.start > pos) {
      segments.add(
        MentionSegment(
          text: value.substring(pos, mention.start),
          isMention: false,
        ),
      );
    }
    segments.add(
      MentionSegment(
        text: value.substring(mention.start, mention.end),
        isMention: true,
      ),
    );
    pos = mention.end;
  }
  if (pos < value.length) {
    segments.add(MentionSegment(text: value.substring(pos), isMention: false));
  }
  return segments;
}
