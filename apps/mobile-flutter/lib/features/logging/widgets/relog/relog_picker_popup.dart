import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/relog.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
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
  });

  final RelogCandidatesResponse candidates;
  final bool isLoading;
  final String query;
  final ValueChanged<RelogCandidate> onSelect;
  final VoidCallback onDismiss;

  /// Web's `max-h-72`. Tall enough for ~4 rows; past that the list scrolls
  /// rather than pushing the composer off the keyboard.
  static const double _maxHeight = 288;

  @override
  Widget build(BuildContext context) {
    final isEmpty = candidates.isEmpty;
    // Distinguish "you have no history yet" from "nothing matched that" — the
    // first is a state the user cannot fix by retyping.
    final emptyMessage =
        isLoading
            ? 'logging.relog.searching'.tr()
            : query.isNotEmpty
            ? 'logging.relog.noResults'.tr()
            : 'logging.relog.noHistory'.tr();

    return Padding(
      padding: const EdgeInsets.only(bottom: LoggingSpacing.block),
      child: Container(
        decoration: BoxDecoration(
          color: NhamColors.elev,
          borderRadius: BorderRadius.circular(NhamRadii.containerLg),
          border: Border.all(color: NhamColors.borderHalf),
          boxShadow: const [NhamShadows.md, NhamShadows.xs],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _Header(onDismiss: onDismiss),
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
                          child: Text(emptyMessage, style: dashMeta()),
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

/// Title plus the close affordance. A phone keyboard has no Escape, so the
/// dismissal the web gets from that key needs a visible control here.
class _Header extends StatelessWidget {
  const _Header({required this.onDismiss});

  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        NhamSpacing.sp3,
        NhamSpacing.sp2,
        NhamSpacing.sp1,
        0,
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              'logging.relog.pickerLabel'.tr().toUpperCase(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: dashEyebrow(),
            ),
          ),
          Semantics(
            button: true,
            label: 'logging.relog.closePicker'.tr(),
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onDismiss,
              child: const SizedBox(
                width: LoggingIcons.hit,
                height: LoggingIcons.hit,
                child: Icon(
                  LucideIcons.x300,
                  size: LoggingIcons.size,
                  color: NhamColors.textMuted,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
