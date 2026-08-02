/// Which of the three shapes a composer submit is.
///
/// Ported from the web's `use-relog-submit.ts`. Pure, so the routing — the one
/// decision that makes a submit produce exactly one review card — can be tested
/// without standing up a feed.
library;

import '../../../../models/relog.dart';

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
  const PureRelog(this.refs);
}

/// Free text AND picks: analyze the text alone and pass the picks as `refs`,
/// so the server merges the copied dishes in and relogged items are never
/// re-analyzed.
class CombinedAnalysis extends ComposerSubmitPlan {
  final String freeText;
  final List<RelogRef> refs;
  const CombinedAnalysis(this.freeText, this.refs);
}

/// Decide what a submit means.
///
/// [isNormal] is load-bearing, not defensive: picks survive a mode switch (only
/// their UI hides), so without it a leftover draft would hijack a CHEAT submit
/// and relog dishes instead of running the estimate — and the server rejects
/// cheat+refs outright.
ComposerSubmitPlan planComposerSubmit({
  required bool isNormal,
  required List<RelogStagedEntry> staged,
  required String text,
  required String freeText,
}) {
  if (!isNormal || staged.isEmpty) return PlainAnalysis(text);
  final refs = [for (final entry in staged) entry.ref];
  if (freeText.isEmpty) return PureRelog(refs);
  return CombinedAnalysis(freeText, refs);
}
