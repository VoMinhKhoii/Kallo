import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';
import '../../../data/manual_log_providers.dart';
import 'manual_added_list.dart';
import 'manual_added_summary.dart';

/// What you have added so far: the running total, the rows, and the commit —
/// summary → list → "Save · N kcal", in that order (native pass, 2026-08-31).
///
/// Save sits directly under the card it commits rather than in a pinned footer
/// bar, so the button and the thing it saves are one block instead of two
/// surfaces separated by the search results.
///
/// It owns the only `watch` of [manualLogProvider] in the sheet, so a grams
/// keystroke rebuilds this block and not the search field or the results.
class ManualAddedBlock extends ConsumerWidget {
  const ManualAddedBlock({super.key, required this.onSave, this.errorText});

  final VoidCallback onSave;

  /// A failed save, reported under the button that attempted it.
  final String? errorText;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(manualLogProvider);
    if (state.items.isEmpty) return const SizedBox.shrink();
    final kcal = state.totals.caloriesKcal?.round() ?? 0;
    final error = errorText;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: KalloSpacing.sp1),
        ManualAddedSummary(totals: state.totals),
        const SizedBox(height: KalloSpacing.sp2),
        ManualAddedList(
          items: state.items,
          disabled: state.isSaving,
          onGramsChange: (id, grams) =>
              ref.read(manualLogProvider.notifier).updateGrams(id, grams),
          onRemove: (id) => ref.read(manualLogProvider.notifier).removeItem(id),
        ),
        const SizedBox(height: KalloSpacing.sp2),
        KalloButton(
          title: 'logging.manualLogging.saveWithKcal'.tr(
            namedArgs: {'kcal': '$kcal'},
          ),
          loading: state.isSaving,
          disabled: !state.canSave,
          onPressed: onSave,
        ),
        if (error != null) ...[
          const SizedBox(height: KalloSpacing.sp1),
          Text(
            error,
            textAlign: TextAlign.center,
            style: dashMeta(color: KalloColors.danger),
          ),
        ],
      ],
    );
  }
}
