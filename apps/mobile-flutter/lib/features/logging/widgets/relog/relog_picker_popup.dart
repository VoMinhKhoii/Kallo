import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/logging/relog.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../shared/widgets/form/quiet_action_button.dart';
import '../../logic/logging_spacing.dart';
import 'relog_picker_close_row.dart';
import 'relog_picker_collapsed.dart';
import 'relog_picker_group.dart';

/// The `/` picker: past dishes and past meals in two labelled groups. INLINE
/// above the composer, in the slot cheat mode's controls occupy, rather than in
/// an [Overlay]: the dock measures itself so the feed can reserve matching
/// scroll padding, where an overlay would float over the last meal card.
class RelogPickerPopup extends StatelessWidget {
  const RelogPickerPopup({
    super.key,
    required this.candidates,
    required this.isLoading,
    required this.query,
    required this.onSelect,
    required this.onDismiss,
    this.hasError = false,
    this.onRetry,
  });

  final RelogCandidatesResponse candidates;
  final bool isLoading;
  final String query;
  final ValueChanged<RelogCandidate> onSelect;
  final VoidCallback onDismiss;

  /// The search itself FAILED — never "no results", which retyping can fix.
  final bool hasError;
  final VoidCallback? onRetry;

  /// Web's `max-h-72`: ~4 rows, then the list scrolls rather than pushing the
  /// composer off the keyboard. A CEILING — the picker yields room before this.
  static const double _maxHeight = 288;

  /// Below this the picker cannot show a single row: its close affordance (44)
  /// and the bottom gap (12) are a rigid 56pt floor, and the rest is a strip too
  /// short to pick from. It hands the room back to the field AND closes itself
  /// ([RelogPickerCollapsed]). UNBOUNDED is `infinity`, so the sheet is spared.
  static const double _minUsableHeight = 120;

  /// Copy ON the band, so the band's own foreground token rather than ink.
  static final _bandCopy = dashMeta(color: KalloColors.bandForeground);

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (_, box) => box.maxHeight < _minUsableHeight
        ? RelogPickerCollapsed(onDismiss: onDismiss)
        : _panel(),
  );

  Widget _panel() {
    final isEmpty = candidates.isEmpty;
    // Three different nothings, not interchangeable: the search failed, nothing
    // matched what you typed, or you have no history. Only the middle retypes.
    final showError = hasError && isEmpty && !isLoading;
    final emptyMessage = isLoading
        ? 'logging.relog.searching'.tr()
        : showError
        ? 'logging.relog.searchFailed'.tr()
        : query.isNotEmpty
        ? 'logging.relog.noResults'.tr()
        : 'logging.relog.noHistory'.tr();

    return Padding(
      padding: const EdgeInsets.only(bottom: LoggingSpacing.block),
      child: Container(
        decoration: BoxDecoration(
          // The band the under-logged notice paints (`PartialDayNotice`): white
          // copy on muted grey, the pairing the tinted mention this COMMITS
          // already renders in. Shadows, no border: it floats over the feed.
          color: KalloColors.bandSurface,
          borderRadius: BorderRadius.circular(KalloRadii.containerLg),
          boxShadow: const [KalloShadows.md, KalloShadows.xs],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            RelogPickerCloseRow(onDismiss: onDismiss),
            Flexible(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: _maxHeight),
                child: isEmpty
                        ? Padding(
                          // The close row above already pays the top inset.
                          padding: const EdgeInsets.all(
                            KalloSpacing.sp3,
                          ).copyWith(top: 0),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(emptyMessage, style: _bandCopy),
                              ),
                              // Nothing to retry on a genuinely empty history.
                              if (showError && onRetry != null)
                                QuietActionButton(
                                  label: 'common.retry'.tr(),
                                  onTap: onRetry!,
                                ),
                            ],
                          ),
                        )
                        : ListView(
                          shrinkWrap: true,
                          padding: const EdgeInsets.all(
                            KalloSpacing.sp2,
                          ).copyWith(top: 0),
                          children: [
                            for (final group in [
                              ('logging.relog.groupDishes', candidates.dishes),
                              ('logging.relog.groupMeals', candidates.meals),
                            ])
                              RelogPickerGroup(
                                label: group.$1.tr(),
                                candidates: group.$2,
                                onSelect: onSelect,
                              ),
                          ],
                        ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
