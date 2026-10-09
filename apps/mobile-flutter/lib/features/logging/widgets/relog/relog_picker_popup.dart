import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/logging/relog.dart';
import '../../../../services/billing/entitlement_state.dart';
import '../../../../services/billing/feature_lock.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../shared/widgets/form/quiet_action_button.dart';
import '../picker/picker_band.dart';
import '../picker/picker_styles.dart';
import 'relog_picker_group.dart';

/// The `/` picker: past dishes and past meals in two labelled groups, on the
/// [PickerBand] it shares with cheat mode's "log it again".
///
/// When the plan lacks `relog` the close row carries a [PremiumChip] and a
/// picked candidate opens the paywall instead of staging.
class RelogPickerPopup extends ConsumerWidget {
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

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final relog = premiumGate(ref, PremiumFeature.relog);
    return PickerBand(
      onDismiss: onDismiss,
      locked: relog.locked,
      body: _body(
        onPick: (pick) => relog.tap(context, () => onSelect(pick))!(),
      ),
    );
  }

  Widget _body({required ValueChanged<RelogCandidate> onPick}) {
    final isEmpty = candidates.isEmpty;
    // Three different nothings, not interchangeable: the search failed, nothing
    // matched what you typed, or you have no history. Only the middle retypes.
    final showError = hasError && isEmpty && !isLoading;
    final emptyMessage =
        isLoading
            ? 'logging.relog.searching'.tr()
            : showError
            ? 'logging.relog.searchFailed'.tr()
            : query.isNotEmpty
            ? 'logging.relog.noResults'.tr()
            : 'logging.relog.noHistory'.tr();

    if (isEmpty) {
      return Padding(
        // The close row above already pays the top inset.
        padding: const EdgeInsets.all(KalloSpacing.sp3).copyWith(top: 0),
        child: Row(
          children: [
            Expanded(child: Text(emptyMessage, style: PickerStyles.meta)),
            // Nothing to retry on a genuinely empty history.
            if (showError && onRetry != null)
              QuietActionButton(label: 'common.retry'.tr(), onTap: onRetry!),
          ],
        ),
      );
    }
    return ListView(
      shrinkWrap: true,
      padding: const EdgeInsets.all(KalloSpacing.sp2).copyWith(top: 0),
      children: [
        for (final group in [
          ('logging.relog.groupDishes', candidates.dishes),
          ('logging.relog.groupMeals', candidates.meals),
        ])
          RelogPickerGroup(
            label: group.$1.tr(),
            candidates: group.$2,
            onSelect: onPick,
          ),
      ],
    );
  }
}
