import 'package:flutter/material.dart';

import '../../../../models/relog.dart';
import '../../../../theme/nham_colors.dart';
import '../../logic/relog/mentions.dart';
import '../../logic/relog/slash_token.dart';
import 'mention_span_builder.dart';

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
/// A committed pick keeps the `/` it was summoned with (see [mentionPrefix])
/// and is painted in [NhamColors.mention] — nothing else. No fill, no chip, no
/// macro preview: the sentence reads `/Phở bò và 2 quả trứng`, so the token is
/// visibly a reference rather than prose even before you register the colour.
class MentionTextEditingController extends TextEditingController {
  MentionTextEditingController({super.text});

  List<RelogMention> _mentions = const [];

  List<RelogMention> get mentions => _mentions;

  /// The staged picks, in composer order.
  List<RelogStagedEntry> get entries => List<RelogStagedEntry>.from(_mentions);

  bool get isFull => _mentions.length >= kRelogMaxStaged;

  /// The `/` token open at the caret, or null — including whenever there is a
  /// selection range (no single insertion point to complete into), or when the
  /// token turns out to be a committed pick's own slash ([isInsideMention]
  /// carries that reasoning).
  SlashToken? get activeToken {
    final selection = value.selection;
    if (!selection.isValid || !selection.isCollapsed) return null;
    final token = parseSlashToken(text, selection.baseOffset);
    if (token == null || isInsideMention(token.start, _mentions)) return null;
    return token;
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
    // The pick KEEPS its slash — it reads as `/Phở bò`, the same shape you
    // typed to summon it. The slash has to live INSIDE the mention's label,
    // not beside it: the label is what `reconcileMentions` matches on, so a
    // slash outside the run would fall out of the tint and survive
    // `stripMentions` as a stray character in what the AI sees.
    final display = '$mentionPrefix${candidate.name}';
    final inserted = insertMention(text, token, display);
    // FIRST in the list, not last. `reconcileMentions` sorts by offset, and the
    // new pick ties with any existing mention that started exactly where this
    // one was spliced in — the tie has to break in favour of the newcomer,
    // because the splice is what pushed the other one right.
    _mentions = reconcileMentions(inserted.value, [
      RelogMention(
        stageId: stageId,
        ref: candidate.ref,
        label: display,
        start: inserted.start,
      ),
      ..._mentions,
    ]);
    value = TextEditingValue(
      text: inserted.value,
      selection: TextSelection.collapsed(offset: inserted.caret),
    );
    notifyListeners();
    return true;
  }

  /// The free text the user typed AROUND the picks — what the AI should see.
  String get freeText => stripMentions(text, _mentions);

  /// Drop the picks and their text after a submit that durably staged, keeping
  /// whatever the user typed alongside — that part is theirs.
  ///
  /// [stageIds] names exactly what was submitted. The field stays editable while
  /// a stage request is in flight, so consuming "everything staged now" would
  /// also swallow a pick made after the POST went out — removed from the
  /// composer despite never having been sent, and unrecoverable.
  void consumeMentions(Set<String> stageIds) {
    final consumed =
        _mentions.where((m) => stageIds.contains(m.stageId)).toList();
    if (consumed.isEmpty) return;
    final next = stripMentions(text, consumed);
    _mentions = reconcileMentions(
      next,
      _mentions.where((m) => !stageIds.contains(m.stageId)).toList(),
    );
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
  }) =>
      buildMentionTextSpan(
        text: text,
        value: value,
        mentions: _mentions,
        style: style,
        withComposing: withComposing,
      ) ??
      super.buildTextSpan(
        context: context,
        style: style,
        withComposing: withComposing,
      );
}
