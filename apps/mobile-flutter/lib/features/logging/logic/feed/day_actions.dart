import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/mutations/day_completion_mutation.dart';
import '../../widgets/actions/confirm_day_complete.dart';
import 'view_state.dart';

/// "Mình ăn đủ rồi": confirm, then attest that an under-logged day is in fact
/// everything the user ate.
///
/// Lives beside the other `*_actions` helpers rather than in the feed widget:
/// this is orchestration (ask, then write), and `feed_area.dart` is already at
/// its size ceiling holding layout.
///
/// One-way, so the dialog is the only guard. The notice is left alone until the
/// refetched day comes back marked, rather than being hidden optimistically on
/// a write that might not have landed.
/// Called from the composer, which renders the notice and so owns its action.
/// Takes the whole [view] rather than loose values: it already carries the day
/// and its calorie total, so the call cannot pass a date that disagrees with
/// the figures the user just read.
Future<void> confirmAndMarkDay(
  BuildContext context,
  WidgetRef ref,
  FeedViewState view,
  String userId,
) async {
  final confirmed = await confirmDayComplete(
    context,
    calories: view.dailyCalories,
  );
  if (!confirmed || !context.mounted) return;
  await markDayComplete(context, ref, userId: userId, date: view.date);
}
