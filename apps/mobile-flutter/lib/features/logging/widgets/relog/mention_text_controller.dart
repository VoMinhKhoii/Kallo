import 'package:flutter/material.dart';

import '../../../../models/logging/relog.dart';
import '../../../../theme/kallo_colors.dart';
import '../../logic/relog/mentions.dart';
import '../../logic/relog/slash_token.dart';
import 'mention_span_builder.dart';

/// The composer's text controller, aware of the picks living inside its value.
///
/// The web paints a mirror `<div>` behind a transparent-text `<textarea>` to
/// tint part of the value, because a browser textarea cannot colour a run of
/// its own text. Flutter can: overriding [buildTextSpan] styles the runs in the
/// REAL field, so caret, selection and glyphs never drift out of register.
///
/// The value is the single source of truth for what the user sees; [mentions]
/// is the parallel list of references plus each one's offset into it.
/// [syncMentions] re-derives those offsets after every edit and DROPS any
/// mention whose text the user broke — what stops a half-deleted dish name
/// from still logging a dish.
/// A relog pick keeps the `/` it was summoned with (see [mentionPrefix]); a
/// scanned one has no marker to keep. Both are painted in
/// [KalloColors.mention] and nothing else — no fill, no chip, no macro preview.
class MentionTextEditingController extends TextEditingController {
  MentionTextEditingController({super.text});

  List<RelogMention> _mentions = const [];

  List<RelogMention> get mentions => _mentions;

  /// The staged picks, in composer order.
  List<RelogStagedEntry> get entries => List<RelogStagedEntry>.from(_mentions);

  bool get isFull => _mentions.length >= kRelogMaxStaged;

  /// The `/` token open at the caret, or null — including on a selection range
  /// (no insertion point to complete into) or when the token turns out to be a
  /// committed pick's own slash ([isInsideMention] carries the reasoning).
  SlashToken? get activeToken {
    final selection = value.selection;
    if (!selection.isValid || !selection.isCollapsed) return null;
    final token = parseSlashToken(text, selection.baseOffset);
    if (token == null || isInsideMention(token.start, _mentions)) return null;
    return token;
  }

  /// Re-locate the mentions against the current text, after every edit. Notifies
  /// only when something moved, so ordinary prose does not rebuild the field.
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
    _commit(
      inserted,
      RelogMention(
        stageId: stageId,
        ref: candidate.ref,
        label: display,
        start: inserted.start,
      ),
    );
    return true;
  }

  /// Splice a pick in at the caret with no `/` token to consume — how a scanned
  /// product enters a sentence, since nothing was typed to summon it. Its label
  /// carries no marker either; the tint is what says "reference". Downstream
  /// copes: `reconcileMentions` matches on the label, `relogPickName` falls
  /// through for one without a prefix.
  bool insertPick(String label, ComposerPickRef ref, String stageId) {
    if (isFull) return false;
    final selection = value.selection;
    final caret = selection.isValid && selection.isCollapsed
        ? selection.baseOffset
        : text.length;
    final inserted = insertMentionAt(text, caret, label);
    _commit(
      inserted,
      RelogMention(
        stageId: stageId,
        ref: ref,
        label: label,
        start: inserted.start,
      ),
    );
    return true;
  }

  /// Re-locate the mentions around a freshly spliced one and write the value.
  /// The newcomer goes FIRST: `reconcileMentions` sorts by offset and it ties
  /// with anything that started where the splice landed — the tie must break
  /// its way, because the splice is what pushed the other one right.
  void _commit(({String value, int caret, int start}) inserted, RelogMention m) {
    _mentions = reconcileMentions(inserted.value, [m, ..._mentions]);
    value = TextEditingValue(
      text: inserted.value,
      selection: TextSelection.collapsed(offset: inserted.caret),
    );
    notifyListeners();
  }

  /// The free text the user typed AROUND the picks — what the AI should see.
  String get freeText => stripMentions(text, _mentions);

  /// Drop the picks and their text after a submit that durably staged, keeping
  /// whatever the user typed alongside. [stageIds] names exactly what was sent:
  /// the field stays editable while a stage is in flight, so consuming
  /// "everything staged now" would swallow a pick that never went out.
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
