/// One logging attempt, frozen exactly as it went out.
library;

import 'package:flutter/foundation.dart';

import '../../../../../models/logging/relog.dart';

/// What a single analyze request carried: the text the AI saw, the picks that
/// rode beside it, and the mode it was estimated under.
///
/// A VALUE rather than a spread of parallel scalars on [FeedAnalysisRun]. The
/// run has to hold TWO of these at once — the one in flight and the one that
/// failed — and "Try again" replays the failed one verbatim. Held as loose
/// fields, that handoff was five assignments copied by hand in `fail()` and
/// five reads in `retry()`, with nothing but discipline keeping the two halves
/// of a pair together: a retry could attach picks the attempt never carried, or
/// resubmit a cheat estimate as a normal analysis, by dropping ONE line.
@immutable
class AnalysisAttempt {
  /// [label] without [refs] is unrepresentable — that is the server's own
  /// cross-field contract (`displayText` requires `refs`, enforced in
  /// `lib/core/validation/meal.ts`), and it is what the send path already
  /// assumes: the server labels a pickless meal with [text], which IS the
  /// sentence, so a label beside no picks could only ever contradict it.
  AnalysisAttempt({
    required this.text,
    this.refs = const [],
    this.pickNames = const [],
    this.label,
    this.isCheat = false,
  }) : assert(
         label == null || refs.isNotEmpty,
         'a displayText without refs is rejected server-side',
       );

  /// The text the AI actually analyzed. STRIPPED on a combined submit — the
  /// picks were pulled out of it before the model saw them, so use [displayText]
  /// for anything the user reads.
  final String text;

  /// The references sent alongside [text], which the server copies verbatim
  /// instead of re-estimating. Empty for a plain submit.
  final List<ComposerPickRef> refs;

  /// [refs] by display name, positionally aligned with them.
  final List<String> pickNames;

  /// The user's OWN sentence with the `/` markers taken off.
  ///
  /// Not a reconstruction. Joining `[text, ...pickNames]` — which is how the
  /// server derives `meals.raw_input` — reorders the sentence whenever a pick
  /// did not come last: typing "/1 cơm gà… + 1 kem vani" came back as
  /// "+ 1 kem vani, 1 cơm gà…", with the typed remainder hoisted in front of
  /// the dish it followed. The card is the user reading their own words back,
  /// so it shows them in the order they wrote them.
  ///
  /// Sent with the submit as `displayText`, so the persisted card carries this
  /// exact string too — one label, from the send through to the saved meal.
  final String? label;

  /// Whether this went out as a cheat estimate. Frozen here because a retry
  /// must replay the attempt that failed, not re-read a mode the user has
  /// switched in the meantime.
  final bool isCheat;

  /// What this attempt's card should SAY: its label when it has one, else the
  /// sentence itself.
  ///
  /// NOT the wire's `displayText`, which is [label] alone — a plain submit
  /// sends none, because there the server's own fallback IS [text].
  String get shownLabel => label ?? text;
}
