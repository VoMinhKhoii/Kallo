import 'package:flutter/material.dart';

import '../../../../models/relog.dart';
import '../../../../theme/nham_colors.dart';
import '../../logic/relog/mentions.dart';
import '../../logic/relog/slash_token.dart';

/// The composer's text controller, aware of the relog picks living inside its
/// own value.
///
/// The web has to paint a mirror `<div>` behind a transparent-text `<textarea>`
/// to tint part of the value (`components/logging/input/relog/mention-overlay.tsx`)
/// — a browser textarea cannot colour a run of its own text. Flutter can:
/// overriding [buildTextSpan] tints the runs in the real field, so the caret,
/// the selection and the glyphs never drift out of register with each other.
/// That is the one deliberate divergence from the web implementation, and it
/// removes the whole class of alignment bugs the mirror exists to manage.
///
/// The value is the single source of truth for what the user sees; [mentions]
/// is the parallel list of references plus each one's offset into it.
/// [syncMentions] re-derives those offsets after every edit and DROPS any
/// mention whose text the user broke — that is what stops a half-deleted dish
/// name from still logging a dish.
/// A picked dish reads as the composer's own inline notice does — the
/// under-logged band that sits in this same card (`PartialDayNotice`): muted
/// grey behind white copy.
///
/// Reusing that pairing keeps the composer to one "this is not your prose"
/// treatment instead of inventing a second, and it retires the palette's one
/// deliberate blue. The contrast is already argued there: [NhamColors.textMuted]
/// is the lightest grey that still clears 4.5:1 against white (~5.2:1).
const Color mentionBackground = NhamColors.textMuted;
const Color mentionForeground = Colors.white;

/// A composer value plus the picks located inside it, taken before a submit
/// clears the field so a failed run can hand both back.
class MentionSnapshot {
  final String text;
  final List<RelogMention> mentions;

  const MentionSnapshot({required this.text, required this.mentions});
}

class MentionTextEditingController extends TextEditingController {
  MentionTextEditingController({super.text});

  List<RelogMention> _mentions = const [];

  List<RelogMention> get mentions => _mentions;

  /// The staged picks, in composer order.
  List<RelogStagedEntry> get entries => List<RelogStagedEntry>.from(_mentions);

  bool get isFull => _mentions.length >= kRelogMaxStaged;

  /// The `/` token open at the caret, or null. Null whenever there is a
  /// selection range rather than a caret, since there is no single insertion
  /// point to complete into.
  SlashToken? get activeToken {
    final selection = value.selection;
    if (!selection.isValid || !selection.isCollapsed) return null;
    return parseSlashToken(text, selection.baseOffset);
  }

  /// Re-locate the mentions against the current text. Call after every edit.
  /// Notifies only when something actually moved, so the field doesn't rebuild
  /// on every keystroke of ordinary prose.
  void syncMentions() {
    final reconciled = reconcileMentions(text, _mentions);
    final unchanged =
        reconciled.length == _mentions.length &&
        List.generate(
          reconciled.length,
          (i) => reconciled[i].start == _mentions[i].start,
        ).every((same) => same);
    if (unchanged) return;
    _mentions = reconciled;
    notifyListeners();
  }

  /// Insert a pick at [token], staging its reference and writing the label into
  /// the text. Returns false when the staged cap is already reached, so the
  /// caller can say so rather than silently dropping the tap.
  ///
  /// Every offset is re-derived from the NEW text rather than trusting the
  /// insertion point alone — mentions after it have all shifted right.
  bool addMention(RelogCandidate candidate, SlashToken token, String stageId) {
    if (isFull) return false;
    final inserted = insertMention(text, token, candidate.name);
    final entry = toStagedEntry(candidate, stageId);
    _mentions = reconcileMentions(inserted.value, [
      ..._mentions,
      RelogMention.at(entry, inserted.start),
    ]);
    value = TextEditingValue(
      text: inserted.value,
      selection: TextSelection.collapsed(offset: inserted.caret),
    );
    notifyListeners();
    return true;
  }

  /// Drop one pick and remove its text. Keyed by [stageId], never by the
  /// reference: picking the same coffee twice is a real meal, and keying on the
  /// reference would make "remove" hit the wrong row.
  void removeMention(String stageId) {
    final target = _mentions.where((m) => m.stageId == stageId).firstOrNull;
    if (target == null) return;
    final next = stripMentions(text, [target]);
    _mentions = reconcileMentions(
      next,
      _mentions.where((m) => m.stageId != stageId).toList(),
    );
    value = TextEditingValue(
      text: next,
      selection: TextSelection.collapsed(offset: next.length),
    );
    notifyListeners();
  }

  /// The free text the user typed AROUND the picks — what the AI should see.
  String get freeText => stripMentions(text, _mentions);

  /// Clear the picks and remove their text, keeping anything typed alongside.
  /// Used after a submit that durably staged: the mentions have been logged, so
  /// their text has served its purpose, but free text is the user's.
  void consumeMentions() {
    if (_mentions.isEmpty) return;
    final next = stripMentions(text, _mentions);
    _mentions = const [];
    value = TextEditingValue(
      text: next,
      selection: TextSelection.collapsed(offset: next.length),
    );
    notifyListeners();
  }

  /// The text AND its picks, captured before a submit that clears the field.
  ///
  /// A combined submit sends the free text alone, so the composer is cleared
  /// the instant the streaming card appears. If that run never durably stages,
  /// the picks must come back intact for a retry — and the mentions cannot be
  /// recovered from the text alone, because [clear] drops them.
  MentionSnapshot snapshot() => MentionSnapshot(text: text, mentions: _mentions);

  /// Put a [snapshot] back. The mentions are re-located against the restored
  /// text rather than trusted, so a snapshot can never resurrect an offset that
  /// no longer points at its label.
  void restore(MentionSnapshot snap) {
    value = TextEditingValue(
      text: snap.text,
      selection: TextSelection.collapsed(offset: snap.text.length),
    );
    _mentions = reconcileMentions(snap.text, snap.mentions);
    notifyListeners();
  }

  /// Replace the whole value, then re-locate the mentions in it.
  void setTextAndSync(String next) {
    value = TextEditingValue(
      text: next,
      selection: TextSelection.collapsed(offset: next.length),
    );
    _mentions = reconcileMentions(next, _mentions);
    notifyListeners();
  }

  @override
  void clear() {
    _mentions = const [];
    super.clear();
  }

  @override
  TextSpan buildTextSpan({
    required BuildContext context,
    TextStyle? style,
    required bool withComposing,
  }) {
    if (_mentions.isEmpty) {
      return super.buildTextSpan(
        context: context,
        style: style,
        withComposing: withComposing,
      );
    }
    // While an IME composing region is live the framework underlines it through
    // the default span; mentions are settled text, so hand that frame back
    // rather than fighting the composing decoration.
    if (withComposing && !value.composing.isCollapsed && value.isComposingRangeValid) {
      return super.buildTextSpan(
        context: context,
        style: style,
        withComposing: withComposing,
      );
    }
    final mentionStyle = (style ?? const TextStyle()).copyWith(
      color: mentionForeground,
      backgroundColor: mentionBackground,
    );
    return TextSpan(
      style: style,
      children: [
        for (final segment in buildMentionSegments(text, _mentions))
          TextSpan(
            text: segment.text,
            style: segment.isMention ? mentionStyle : null,
          ),
      ],
    );
  }
}
