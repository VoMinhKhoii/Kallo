import 'package:flutter/material.dart';

import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/logging_spacing.dart';
import 'picker_close_row.dart';
import 'picker_collapsed.dart';

/// The grey band a composer picker floats on — the `/` relog picker and cheat
/// mode's "log it again". INLINE above the composer, in `MealInput`'s
/// `popupSlot`, rather than in an [Overlay]: the dock measures itself so the
/// feed can reserve matching scroll padding, where an overlay would float over
/// the last meal card.
///
/// It is the half of the dock that YIELDS: [body] is capped at
/// [maxBodyHeight] and scrolls past it, and below [minUsableHeight] the band
/// hands its room back to the field and closes itself ([PickerCollapsed]).
/// That is what keeps the composer above the keyboard however long the list.
class PickerBand extends StatelessWidget {
  const PickerBand({
    super.key,
    required this.onDismiss,
    required this.body,
    this.title,
    this.locked = false,
  });

  final VoidCallback onDismiss;

  /// The band's content under the close row — a list, or an empty / error line.
  final Widget body;

  /// Shown at the close row's left; see [PickerCloseRow].
  final String? title;

  /// The plan lacks this band's feature: the close row carries a premium chip.
  final bool locked;

  /// Web's `max-h-72`: ~4 rows, then the list scrolls rather than pushing the
  /// composer off the keyboard. A CEILING — the band yields room before this.
  static const double maxBodyHeight = 288;

  /// Below this the band cannot show a single row: its close affordance (44)
  /// and the bottom gap (12) are a rigid 56pt floor, and the rest is a strip
  /// too short to pick from. UNBOUNDED is `infinity`, so a sheet is spared.
  static const double minUsableHeight = 120;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder:
          (_, box) =>
              box.maxHeight < minUsableHeight
                  ? PickerCollapsed(onDismiss: onDismiss)
                  : _band(),
    );
  }

  Widget _band() {
    return Padding(
      padding: const EdgeInsets.only(bottom: LoggingSpacing.block),
      child: Container(
        decoration: BoxDecoration(
          // The band the under-logged notice paints (`PartialDayNotice`): white
          // copy on muted grey, the pairing the tinted mention a relog pick
          // COMMITS already renders in. Shadows, no border: it floats over the
          // feed.
          color: KalloColors.bandSurface,
          borderRadius: BorderRadius.circular(KalloRadii.containerLg),
          boxShadow: const [KalloShadows.md, KalloShadows.xs],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            PickerCloseRow(onDismiss: onDismiss, title: title, locked: locked),
            Flexible(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: maxBodyHeight),
                child: body,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
