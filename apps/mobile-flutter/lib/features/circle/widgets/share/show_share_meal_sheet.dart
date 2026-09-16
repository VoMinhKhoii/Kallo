import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../logging/data/logging_models.dart';
import '../../data/circle_providers.dart';
import 'share_meal_outcome.dart';
import 'share_meal_sheet.dart';


/// Opens the "share this meal" sheet: pick whether everyone gets a full
/// portion or the dish is divided, set who is at the table, and — on a split —
/// how much each of them had.
///
/// The confirmation toast is raised HERE, from [context], rather than inside
/// the sheet. Two reasons, both learned the hard way: the sheet's own context
/// is disposed moments after it pops, and a NavigatorState's context sits above
/// the overlay `showTopToast` searches, so a toast raised from either simply
/// never appears — taking the undo affordance with it. The opening context is
/// inside the overlay and outlives the sheet.
Future<void> showShareMealSheet(BuildContext context, PersistedMeal meal) async {
  final container = ProviderScope.containerOf(context, listen: false);
  final outcome = await showNhamSheet<ShareMealOutcome>(
    context,
    isScrollControlled: true,
    builder: (_) => ShareMealSheet(meal: meal),
  );
  if (outcome == null || !context.mounted) return;

  showTopToast(
    context,
    (outcome.isSplit
            ? 'groups.shareMeal.splitSuccess'
            : 'groups.shareMeal.copySuccess')
        .plural(outcome.count, namedArgs: {'count': '${outcome.count}'}),
    // The undo rides on the confirmation rather than a separate surface: it is
    // only ever wanted in the seconds right after the tap.
    actionLabel: outcome.isSplit ? tr('groups.shareMeal.undo') : null,
    // Five seconds, not the 2.2s default: this toast is the ONLY undo
    // affordance in the feature, and a split permanently rescales a meal the
    // user already logged. A confirmation you can only read is a different
    // thing from one you can act on.
    duration: outcome.isSplit
        ? const Duration(seconds: 5)
        : const Duration(milliseconds: 2200),
    onAction: outcome.isSplit
        ? () => _runUndo(container, context, outcome.mealId)
        : null,
  );
}

/// Runs after the sheet is gone, so it holds no widget state — only a
/// container and a context that both outlive it.
Future<void> _runUndo(
  ProviderContainer container,
  BuildContext hostContext,
  String mealId,
) async {
  try {
    await undoMealShare(container, mealId);
  } catch (_) {
    // Refused (someone already accepted) or offline.
    if (!hostContext.mounted) return;
    showTopToast(
      hostContext,
      tr('groups.shareMeal.undoFailed'),
      variant: TopToastVariant.error,
    );
  }
}
