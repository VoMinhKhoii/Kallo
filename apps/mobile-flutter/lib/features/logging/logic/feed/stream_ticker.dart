/// The one line the streaming surface shows, derived fresh from the analysis
/// state — the Dart port of the web dashboard/circle meal bar's ticker
/// (`hooks/dashboard/use-dashboard-meal-log.tsx`).
///
/// Frames carry l10n KEYS, not resolved text, so the derivation is a pure
/// function testable without an `easy_localization` bootstrap.
library;

import '../../../../models/logging/streaming.dart';
import '../../data/stream_analysis_controller.dart';

/// Statuses with a phase label of their own; everything else falls back to
/// "Analyzing…" (the web `getStreamingPhaseLabel` default).
String phaseLabelKey(StreamStatus status) => switch (status) {
  StreamStatus.connecting => 'logging.streaming.connecting',
  StreamStatus.decomposing => 'logging.streaming.decomposing',
  StreamStatus.matching => 'logging.streaming.matching',
  StreamStatus.estimating => 'logging.streaming.estimating',
  StreamStatus.assembling => 'logging.streaming.assembling',
  _ => 'logging.streaming.analyzing',
};

/// One frame of the ticker. A new [key] flips the line; an unchanged key must
/// leave it alone, so keys are derived from the DATA and never from a counter
/// that would churn on every rebuild.
sealed class StreamTickerFrame {
  const StreamTickerFrame();

  String get key;
}

/// A pipeline stage — quiet muted sans.
final class PhaseFrame extends StreamTickerFrame {
  const PhaseFrame(this.status);

  final StreamStatus status;

  String get labelKey => phaseLabelKey(status);

  @override
  String get key => 'phase-${status.name}';
}

/// A dish the pipeline just named but hasn't priced yet — the meal's own words,
/// rendered with a trailing ellipsis.
final class ItemFrame extends StreamTickerFrame {
  const ItemFrame({required this.name, required this.count});

  final String name;

  /// How many names had arrived when this frame was built. Part of the key so
  /// two dishes with the same name still flip the line.
  final int count;

  @override
  String get key => 'name-$count';
}

/// A dish that just resolved — its name plus the calories it landed on.
final class MacrosFrame extends StreamTickerFrame {
  const MacrosFrame({
    required this.id,
    required this.name,
    required this.calories,
  });

  final String id;
  final String name;
  final int calories;

  @override
  String get key => 'done-$id';
}

/// The current frame, or null when nothing is in flight.
///
/// Precedence is the web's, 1:1: assembling label > latest resolved item >
/// latest named item > stage label. The `assembling` carve-out is deliberate —
/// once the pipeline is assembling, the line stops advertising dishes and says
/// what it is doing.
///
/// The web's first branch (`isSaving`) has NO mobile counterpart: the mobile
/// flow ends at a user-confirmed reveal card, not an auto-save, so there is no
/// saving phase to announce.
StreamTickerFrame? deriveStreamTicker(StreamAnalysisState stream) {
  if (!stream.isAnalyzing) return null;

  if (stream.status != StreamStatus.assembling) {
    if (stream.completedItems.isNotEmpty) {
      final done = stream.completedItems.last;
      return MacrosFrame(
        id: done.id,
        name: done.name,
        calories: done.macros.calories.round(),
      );
    }
    if (stream.items.isNotEmpty) {
      return ItemFrame(name: stream.items.last, count: stream.items.length);
    }
  }

  return PhaseFrame(stream.status);
}
