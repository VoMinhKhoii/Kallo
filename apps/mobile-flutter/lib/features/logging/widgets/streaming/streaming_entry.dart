import 'package:flutter/widgets.dart';

import '../../../../models/meal.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_theme.dart';
import '../../data/stream_analysis_controller.dart';
import '../../logic/feed/stream_ticker.dart';
import '../../logic/logging_spacing.dart';
import '../entrances.dart';
import '../macro_trio.dart';
import 'stream_ticker_line.dart';

/// The in-flight analysis, rendered BARE on the feed canvas — no card, no
/// border, no shadow.
///
/// The card is the finished thing: while this runs, the user's words are in the
/// chat bubble above and the data simply streams out underneath it. Resolved
/// rows waterfall in as their macros land, detected-but-unpriced names follow,
/// and the ticker line at the bottom is the single loading state. On `done`
/// this is replaced by a `MealEntry` reveal card.
class StreamingEntry extends StatelessWidget {
  const StreamingEntry({
    super.key,
    required this.stream,
    required this.loaderIndex,
  });

  final StreamAnalysisState stream;

  /// Index into `kSvgLoaders`, picked once per meal by the feed.
  final int loaderIndex;

  @override
  Widget build(BuildContext context) {
    final completed = stream.completedItems;
    final completedNames = completed.map((i) => i.name.toLowerCase()).toSet();
    // Names detected but not yet carrying macros — the streaming waterfall.
    final pendingNames = stream.items
        .where((n) => !completedNames.contains(n.toLowerCase()))
        .toList();
    final hasItems = completed.isNotEmpty || pendingNames.isNotEmpty;

    return Padding(
      // Matches LoggingSpacing.card's horizontal inset, so a row does not jump
      // sideways the moment the reveal card closes around it.
      padding: const EdgeInsets.symmetric(horizontal: NhamSpacing.sp4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // The loading state is PINNED at the top. Below the rows it slid down
          // by a row's height every time a dish landed, so the one thing on
          // screen that is meant to say "still working" was the thing that
          // never held still.
          StreamTickerLine(
            frame: deriveStreamTicker(stream),
            loaderIndex: loaderIndex,
          ),
          if (hasItems) ...[
            const SizedBox(height: NhamSpacing.sp1),
            for (var i = 0; i < completed.length; i++)
              FadeInLeft(
                key: ValueKey(completed[i].id),
                offset: 8,
                delay: Duration(milliseconds: i * 40),
                child: _CompletedRow(item: completed[i]),
              ),
            for (var i = 0; i < pendingNames.length; i++)
              FadeInLeft(
                key: ValueKey('${pendingNames[i]}-$i'),
                offset: 8,
                child: _PendingNameRow(name: pendingNames[i]),
              ),
          ],
        ],
      ),
    );
  }
}

/// A resolved item: name + real P/C/F + calories.
class _CompletedRow extends StatelessWidget {
  const _CompletedRow({required this.item});

  final MealItem item;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: LoggingSpacing.row),
      child: Row(
        children: [
          // Two lines + ellipsis, as the persisted card's rows: the fixed macro
          // tail leaves too little width for a typical Vietnamese dish.
          Expanded(
            child: Text(
              item.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: dashBody(),
            ),
          ),
          const SizedBox(width: NhamSpacing.sp3),
          MacroTrio(
            protein: item.macros.protein,
            carbs: item.macros.carbs,
            fat: item.macros.fat,
            calories: item.macros.calories,
          ),
        ],
      ),
    );
  }
}

/// A detected-but-unresolved item: just the name, muted, its macros still in
/// flight. The ticker line below is the only loading cue.
class _PendingNameRow extends StatelessWidget {
  const _PendingNameRow({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: LoggingSpacing.row),
      child: Text(name, maxLines: 1, style: dashBody(color: kInkMuted)),
    );
  }
}
