import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../services/billing/feature_lock.dart';
import '../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../logging/data/logging_models.dart';
import '../../data/circle_providers.dart';
import '../invite/add_friend_sheet.dart';
import 'share_meal_request.dart';
import 'share_meal_sheet.dart';

/// Opens the "share this meal" sheet: pick whether everyone gets a full
/// portion or the dish is divided, set who is at the table, and — on a split —
/// how much each of them had.
///
/// Nothing is sent when the sheet closes. The share is held for the five
/// seconds its toast is up and posted only once the toast runs out, so "Hoàn
/// tác" just drops it — no server round trip, and no friend is ever notified
/// of a share that was taken back. Same shape as removing a meal
/// (`meal_actions.dart`).
///
/// The toast is raised HERE, from [context], rather than inside the sheet: the
/// sheet's own context is disposed moments after it pops, and a
/// NavigatorState's context sits above the overlay `showTopToast` searches, so
/// a toast raised from either never appears. The opening context is inside the
/// overlay and outlives the sheet.
Future<void> showShareMealSheet(
  BuildContext context,
  PersistedMeal meal,
) async {
  final container = ProviderScope.containerOf(context, listen: false);
  final request = await showNhamSheet<ShareMealRequest>(
    context,
    isScrollControlled: true,
    builder:
        (sheetContext) => ShareMealSheet(
          meal: meal,
          onAddFriends: () {
            Navigator.of(sheetContext).pop();
            if (context.mounted) showAddFriendSheet(context);
          },
        ),
  );
  if (request == null || !context.mounted) return;

  // Sent through the container, not the host context: the user may have left
  // the screen during the window, and that must not drop a share they kept.
  // The sheet (and its draft) is gone by then, so a failure offers the same
  // request again rather than making the user rebuild the split.
  Future<void> send() async {
    try {
      await shareMealWithFriends(
        container,
        mealId: request.mealId,
        friendUserIds: request.friendUserIds,
        mode: request.isSplit ? 'split' : 'copy',
        myParts: request.myParts,
        splits: request.splits,
      );
    } catch (error) {
      if (!context.mounted) return;
      if (handledFeatureLock(context, error)) return;
      showTopToast(
        context,
        tr('groups.shareMeal.error'),
        variant: TopToastVariant.error,
        actionLabel: tr('common.retry'),
        duration: const Duration(seconds: 5),
        onAction: send,
      );
    }
  }

  var undone = false;
  await showTopToast(
    context,
    (request.isSplit
            ? 'groups.shareMeal.splitSuccess'
            : 'groups.shareMeal.copySuccess')
        .plural(request.count, namedArgs: {'count': '${request.count}'}),
    actionLabel: tr('groups.shareMeal.undo'),
    duration: const Duration(seconds: 5),
    onAction: () => undone = true,
  );
  if (undone) return;
  await send();
}
