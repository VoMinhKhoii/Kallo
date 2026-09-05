import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/toast/top_toast.dart';
import '../../data/logging_providers.dart';
import '../../widgets/composer/meal_input.dart';
import '../../widgets/relog/mention_text_controller.dart';

/// Long-press a sent message → Edit → its words are back in the composer.
///
/// The bubble cannot reach the composer's controller: it sits inside a meal
/// card, arbitrarily deep in the day's list, and in the live turn's footer. So
/// it parks the text in [composerRefillProvider] and the composer picks it up
/// here — the same shape as the dashboard's quick-log hand-off, minus the
/// analysis run, because Edit is explicitly the path that does NOT re-analyse
/// on the spot.
///
/// LISTENED to, not watched — the opposite of `PendingMealHandoff`, and for the
/// opposite reason. That hand-off is written by surfaces on other routes, so it
/// has to survive until the feed first builds; this one is written by a bubble
/// the composer is already on screen with, so the null → text transition can
/// never be missed and no claim flag is needed to make it fire once. What it
/// does need is the slot emptied on the way out: `StateProvider` notifies only
/// on a CHANGE, so leaving the text parked would make editing the same message
/// twice in a row silently do nothing the second time.
void listenForComposerRefill(
  WidgetRef ref, {
  required BuildContext context,
  required MentionTextEditingController composer,
  required MealInputController input,
}) {
  ref.listen<String?>(composerRefillProvider, (_, parked) {
    if (parked == null) return;
    _refill(ref, context: context, composer: composer, input: input);
  });
}

Future<void> _refill(
  WidgetRef ref, {
  required BuildContext context,
  required MentionTextEditingController composer,
  required MealInputController input,
}) async {
  final text = ref.read(composerRefillProvider)?.trim() ?? '';
  // Emptied before anything else can fail, so a slot can never stay stuck.
  ref.read(composerRefillProvider.notifier).state = null;
  if (text.isEmpty) return;

  // Captured with its picks: an Undo has to give back the relog references
  // inside the displaced draft, not just its words. (The message coming IN
  // carries none — a sent bubble is plain text, so a pick that was edited back
  // into the composer returns as the words it printed.)
  final displaced = composer.snapshot();
  composer.setTextAndSync(text);
  input.focus();

  // Nothing was displaced: a toast saying so would be noise.
  if (displaced.text.trim().isEmpty) return;
  await showTopToast(
    context,
    'logging.draftReplaced'.tr(),
    actionLabel: 'logging.undo'.tr(),
    duration: const Duration(seconds: 5),
    onAction: () {
      // The toast lives in the root overlay and outlives this screen; the
      // controller does not. Restoring onto a disposed one throws.
      if (!context.mounted) return;
      composer.restore(displaced);
      input.focus();
    },
  );
}
