import 'package:flutter/material.dart';

import '../../../../models/relog.dart';
import '../../../../theme/nham_colors.dart';
import '../../logic/relog/mentions.dart';
import '../../logic/relog/slash_token.dart';

/// The composer's text controller, aware of the relog picks living inside its
/// own value.
///
/// The web paints a mirror `<div>` behind a transparent-text `<textarea>` to
/// tint part of the value (`input/relog/mention-overlay.tsx`) because a browser
/// textarea cannot colour a run of its own text. Flutter can: overriding
/// [buildTextSpan] styles the runs in the REAL field, so caret, selection and
/// glyphs can never drift out of register — the whole class of bugs the mirror
/// exists to manage.
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
class MentionTextEditingController extends TextEditingController {
  MentionTextEditingController({super.text});

  List<RelogMention> _mentions = const [];

  List<RelogMention> get mentions => _mentions;

  /// The staged picks, in composer order.
  List<RelogStagedEntry> get entries => List<RelogStagedEntry>.from(_mentions);

  bool get isFull => _mentions.length >= kRelogMaxStaged;

  /// The `/` token open at the caret, or null — including whenever there is a
  /// selection range, which has no single insertion point to complete into.
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

  /// Write [next] with the caret at its end — every mutation that rewrites the
  /// whole value goes through here.
  void _setValueAtEnd(String next) {
    value = TextEditingValue(
      text: next,
      selection: TextSelection.collapsed(offset: next.length),
    );
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
    _setValueAtEnd(next);
    notifyListeners();
  }

  /// The free text the user typed AROUND the picks — what the AI should see.
  String get freeText => stripMentions(text, _mentions);

  /// Drop the picks and their text after a submit that durably staged, keeping
  /// whatever the user typed alongside — that part is theirs.
  void consumeMentions() {
    if (_mentions.isEmpty) return;
    final next = stripMentions(text, _mentions);
    _mentions = const [];
    _setValueAtEnd(next);
    notifyListeners();
  }

  /// The text AND its picks, captured before a submit that clears the field —
  /// the picks must come back intact if that run never durably stages.
  MentionSnapshot snapshot() =>
      MentionSnapshot(text: text, mentions: _mentions);

  /// Put a snapshot back. Mentions are RE-LOCATED against the restored text
  /// rather than trusted, so a stale offset can never resurrect a reference.
  void restore(MentionSnapshot snap) {
    _setValueAtEnd(snap.text);
    _mentions = reconcileMentions(snap.text, snap.mentions);
    notifyListeners();
  }

  /// Replace the whole value, then re-locate the mentions in it.
  void setTextAndSync(String next) {
    _setValueAtEnd(next);
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
    // Bail only when a composing region OVERLAPS a pick, where the framework's
    // underline and our band would fight over the same glyphs. Bailing on ANY
    // composing region would strobe the band: Vietnamese IMEs compose per
    // syllable, so it would drop on nearly every keystroke.
    final composing = value.composing;
    if (withComposing &&
        value.isComposingRangeValid &&
        !composing.isCollapsed &&
        _mentions.any(
          (m) => composing.start < m.end && m.start < composing.end,
        )) {
      return super.buildTextSpan(
        context: context,
        style: style,
        withComposing: withComposing,
      );
    }
    final mentionStyle = (style ?? const TextStyle()).copyWith(
      color: NhamColors.mentionForeground,
      backgroundColor: NhamColors.mentionBackground,
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
