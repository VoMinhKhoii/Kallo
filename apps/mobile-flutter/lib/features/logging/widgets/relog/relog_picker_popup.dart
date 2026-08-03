import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/relog.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import '../../../../shared/widgets/quiet_action_button.dart';
import '../../logic/logging_spacing.dart';
import 'relog_picker_group.dart';

/// The `/` picker: past dishes and past meals in two labelled groups.
///
/// It sits INLINE above the composer, in the slot cheat mode's controls occupy,
/// rather than in an [Overlay]. The dock measures itself and reports its height
/// so the feed reserves matching scroll padding — an overlay would float over
/// the last meal card instead, and the picker is tall.
///
/// Group headers are presentational: selection is by tap, so there is no
/// keyboard cursor that could land on one.
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

  /// The search itself failed. Distinct from "no results": telling someone with
  /// a year of meals that they have never logged anything is worse than saying
  /// nothing, and it is not a state retyping can fix.
  final bool hasError;
  final VoidCallback? onRetry;

  /// Web's `max-h-72`. Tall enough for ~4 rows; past that the list scrolls
  /// rather than pushing the composer off the keyboard.
  static const double _maxHeight = 288;

  @override
  Widget build(BuildContext context) {
    final isEmpty = candidates.isEmpty;
    // Three different nothings, and they are not interchangeable: the search
    // failed, nothing matched what you typed, or you have no history at all.
    // Only the middle one is fixed by retyping.
    final showError = hasError && isEmpty && !isLoading;
    final emptyMessage =
        isLoading
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
          // The same band the composer's inline under-logged notice paints
          // (`PartialDayNotice`): white copy on muted grey. The picker sits in
          // that same card, and what it COMMITS — the tinted mention inside the
          // field — already renders in this exact pairing, so the picker and its
          // own output finally read as one thing.
          //
          // No border, like the notice: a solid band does not need one. The
          // shadows stay, unlike the notice, because that sits inside the card
          // while this floats over the feed and has to lift off it.
          color: NhamColors.mentionBackground,
          borderRadius: BorderRadius.circular(NhamRadii.containerLg),
          boxShadow: const [NhamShadows.md, NhamShadows.xs],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _CloseRow(onDismiss: onDismiss),
            Flexible(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: _maxHeight),
                child:
                    isEmpty
                        ? Padding(
                          padding: const EdgeInsets.fromLTRB(
                            NhamSpacing.sp3,
                            0,
                            NhamSpacing.sp3,
                            NhamSpacing.sp3,
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  emptyMessage,
                                  style: dashMeta(
                                    color: NhamColors.mentionForeground,
                                  ),
                                ),
                              ),
                              // Retry only on failure — there is nothing to
                              // retry when the history is genuinely empty.
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
                          padding: const EdgeInsets.fromLTRB(
                            NhamSpacing.sp2,
                            0,
                            NhamSpacing.sp2,
                            NhamSpacing.sp2,
                          ),
                          children: [
                            RelogPickerGroup(
                              label: 'logging.relog.groupDishes'.tr(),
                              candidates: candidates.dishes,
                              onSelect: onSelect,
                            ),
                            RelogPickerGroup(
                              label: 'logging.relog.groupMeals'.tr(),
                              candidates: candidates.meals,
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

/// The close affordance, alone on its row.
///
/// The popup carries no title: the `/` you just typed is the label, and the two
/// group headers below already say what is in the list.
///
/// The button is NOT optional chrome. A phone keyboard has no Escape, and the
/// picker is an inline sibling in the dock rather than an overlay — no barrier,
/// no `PopScope`, nothing closes on a tap outside. Without this the only ways
/// out are picking something or editing your sentence until the `/` breaks,
/// while a 288px panel holds the composer up. It is also the sole caller of
/// [SlashPickerState.dismiss], so removing it would strand that suppression
/// logic entirely.
class _CloseRow extends StatelessWidget {
  const _CloseRow({required this.onDismiss});

  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: Semantics(
        button: true,
        label: 'logging.relog.closePicker'.tr(),
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onDismiss,
          child: const SizedBox(
            width: LoggingIcons.hit,
            height: LoggingIcons.hit,
            // White @ 70% — the notice's own dismiss glyph. The only element on
            // the band allowed to be translucent: it carries no text, so it is
            // not held to the 4.5:1 the copy is.
            child: Icon(
              LucideIcons.x300,
              size: LoggingIcons.size,
              color: NhamColors.mentionForeground70,
            ),
          ),
        ),
      ),
    );
  }
}
