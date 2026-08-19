/// Which of the three shapes a composer submit is.
///
/// Ported from the web's `use-relog-submit.ts`. Pure, so the routing — the one
/// decision that makes a submit produce exactly one review card — can be tested
/// without standing up a feed.
library;

import '../../../../models/logging/relog.dart';
import 'relog_label.dart';

sealed class ComposerSubmitPlan {
  const ComposerSubmitPlan();
}

/// Text only (or a mode that has no picks): the ordinary AI analysis reads the
/// composer itself.
class PlainAnalysis extends ComposerSubmitPlan {
  final String text;
  const PlainAnalysis(this.text);
}

/// Picks only, no free text: stage a deterministic relog analysis and surface
/// its review card. No AI, no provider spend.
class PureRelog extends ComposerSubmitPlan {
  final List<RelogRef> refs;

  /// The stage ids behind [refs]. Carried so the composer can clear EXACTLY
  /// what it submitted: the field stays editable while the request is in
  /// flight, and clearing "whatever is staged now" would drop a pick the user
  /// made after the POST went out — one that was never staged and will not come
  /// back. They also identify the selection, so a retry of the same picks can
  /// reuse its attempt id instead of staging a second card.
  final List<String> stageIds;

  const PureRelog(this.refs, this.stageIds);
}

/// Free text AND picks: analyze the text alone and pass the picks as `refs`,
/// so the server merges the copied dishes in and relogged items are never
/// re-analyzed.
class CombinedAnalysis extends ComposerSubmitPlan {
  final String freeText;
  final List<RelogRef> refs;

  /// The picks' display names, positionally aligned with [refs]. Carried here
  /// rather than re-derived at the call site so the card's label can never
  /// disagree with what was actually sent.
  final List<String> pickNames;

  const CombinedAnalysis(this.freeText, this.refs, this.pickNames);
}

/// Decide what a submit means.
///
/// [isNormal] is load-bearing, not defensive: picks survive a mode switch (only
/// their UI hides), so without it a leftover draft would hijack a CHEAT submit
/// and relog dishes instead of running the estimate — and the server rejects
/// cheat+refs outright.
///
/// It is not enough on its own, though. Suppressing the refs still leaves the
/// picks' TEXT in the composer, and on this platform that text carries the `/`
/// the pick was summoned with — so a cheat submit used to send the estimator
/// `/Phở bò và trứng`, slash and all. The web composer writes bare names and so
/// has always sent clean prose here; stripping the marker is what makes the two
/// read the same. The reference is still dropped, on both platforms and by
/// design: cheat mode cannot carry one.
ComposerSubmitPlan planComposerSubmit({
  required bool isNormal,
  required List<RelogStagedEntry> staged,
  required String text,
  required String freeText,
}) {
  if (!isNormal) return PlainAnalysis(unmarkPicks(text, staged));
  if (staged.isEmpty) return PlainAnalysis(text);
  final refs = [for (final entry in staged) entry.ref];
  if (freeText.isEmpty) {
    return PureRelog(refs, [for (final entry in staged) entry.stageId]);
  }
  return CombinedAnalysis(freeText, refs, [
    for (final entry in staged) relogPickName(entry),
  ]);
}
