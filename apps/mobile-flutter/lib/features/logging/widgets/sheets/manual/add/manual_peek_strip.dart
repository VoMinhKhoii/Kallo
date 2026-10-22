import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../../theme/calm_tokens.dart';
import '../../../../logic/manual/manual_display.dart';
import '../../../../../../theme/kallo_colors.dart';

/// The meal sheet's edge, peeking above the add sheet stacked on it, with the
/// one thing worth knowing while you search: what is already on the plate,
/// and on a food's page what the plate becomes with it.
///
/// Drawn by the add sheet itself rather than by scaling the meal sheet back the
/// way UIKit does: Flutter's modal route has no presenting-sheet transform, and
/// the strip is the part of that look that carries information.
class ManualPeekStrip extends StatelessWidget {
  const ManualPeekStrip({super.key, required this.peek});

  /// What to say — `manualPeek`'s reading of the plate and the open food.
  final ManualPeek peek;

  /// How much of the strip shows above the add sheet: its 7pt inset, one
  /// caption line at the reader's text size, and 4pt of air — 26 at 1x.
  static double visibleHeight(BuildContext context) =>
      7 + MediaQuery.textScalerOf(context).scale(12) * 1.25 + 4;

  /// The strip's tint: the meal sheet's canvas under the route's dimming.
  static Color get _fill => KalloColors.sheetPeek;
  static Color get _ink => KalloColors.sheetPeekInk;

  static String _summary(int count, double? kcal) =>
      'logging.manualLogging.peek'.tr(
        namedArgs: {
          'count': 'logging.manualLogging.ingredientCount'.plural(count),
          'kcal': formatKcal(kcal),
        },
      );

  @override
  Widget build(BuildContext context) {
    // The arrow is an icon: Be Vietnam Pro has no "→" glyph, and iOS would set
    // that one character in a fallback face.
    final (text, after) = switch (peek) {
      PeekEmpty() => ('logging.manualLogging.peekEmpty'.tr(), null),
      PeekChange(:final count, :final kcal, :final after, :final edit) => (
        _summary(count, kcal),
        (edit
                ? 'logging.manualLogging.peekAfter'
                : 'logging.manualLogging.peekWith')
            .tr(namedArgs: {'kcal': formatKcal(after)}),
      ),
      PeekTotal(:final count, :final kcal) => (_summary(count, kcal), null),
    };
    return Container(
      padding: const EdgeInsets.only(top: 7, left: 24, right: 24),
      decoration: BoxDecoration(
        color: _fill,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
      ),
      alignment: Alignment.topCenter,
      child: Text.rich(
        TextSpan(
          text: text,
          children: [
            if (after != null) ...[
              const TextSpan(text: ' '),
              WidgetSpan(
                alignment: PlaceholderAlignment.middle,
                child: Icon(LucideIcons.arrowRight300, size: 12, color: _ink),
              ),
              TextSpan(text: ' $after'),
            ],
          ],
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        textAlign: TextAlign.center,
        // Caption tier: a sliver of the sheet behind, not a row of this one.
        style: dashCaption(color: _ink, tabular: true),
      ),
    );
  }
}
