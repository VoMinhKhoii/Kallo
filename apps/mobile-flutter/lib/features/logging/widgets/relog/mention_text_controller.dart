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

  /// Write [next] with the caret at [caret] — every mutation that rewrites the
  /// whole value goes through here.
  void _write(String next, int caret) {
    value = TextEditingValue(
      text: next,
      selection: TextSelection.collapsed(offset: caret),
    );
  }

  /// Insert a pick at [token], staging its reference and writing the label into
  /// the text. Returns false when the staged cap is already reached, so the
  /// caller can say so rather than silently dropping the tap.
  bool addMention(RelogCandidate candidate, SlashToken token, String stageId) {
    if (isFull) return false;
    // The pick KEEPS its slash — it reads as `/Phở bò`, the same shape you
    // typed to summon it, and the slash lives INSIDE the label: that is what
    // `reconcileMentions` matches on, so a slash outside the run would fall
    // out of the tint and reach the AI as a stray character.
    final display = '$mentionPrefix${candidate.name}';
    final entry = RelogStagedEntry(
      stageId: stageId,
      ref: candidate.ref,
      label: display,
    );
    _commit(insertMention(text, token, display), entry, at: token.start);
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
    // [resolvePickSplice] owns both hazards a raw caret carries: one resting
    // inside a committed label, and a selection RANGE the pick replaces.
    final splice = resolvePickSplice(
      text,
      _mentions,
      start: selection.isValid ? selection.start : text.length,
      end: selection.isValid ? selection.end : text.length,
    );
    final entry = RelogStagedEntry(stageId: stageId, ref: ref, label: label);
    _commit(
      insertMentionAt(splice.text, splice.at, label),
      entry,
      at: splice.at,
    );
    return true;
  }

  /// Stage [entry] where the splice landed and write the new value.
  ///
  /// [at] is the splice index: every mention from there on arrives already
  /// carrying its new offset, so the reconcile sorts on real positions and
  /// nothing depends on the newcomer being listed first — the assumption a
  /// caret anywhere but the end of the sentence quietly broke.
  void _commit(
    ({String value, int caret, int start}) inserted,
    RelogStagedEntry entry, {
    required int at,
  }) {
    final delta = inserted.value.length - text.length;
    _mentions = reconcileMentions(inserted.value, [
      RelogMention.at(entry, inserted.start),
      ...shiftMentions(_mentions, at: at, delta: delta),
    ]);
    _write(inserted.value, inserted.caret);
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
    _write(next, next.length);
    notifyListeners();
  }

  /// The text AND its picks, captured before a submit that clears the field —
  /// the picks must come back intact if that run never durably stages.
  MentionSnapshot snapshot() =>
      MentionSnapshot(text: text, mentions: _mentions);

  /// Put a snapshot back. Mentions are RE-LOCATED against the restored text
  /// rather than trusted, so a stale offset can never resurrect a reference.
  void restore(MentionSnapshot snap) {
    _write(snap.text, snap.text.length);
    _mentions = reconcileMentions(snap.text, snap.mentions);
    notifyListeners();
  }

  /// Replace the whole value, then re-locate the mentions in it.
  void setTextAndSync(String next) {
    _write(next, next.length);
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
