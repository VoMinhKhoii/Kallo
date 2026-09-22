import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/social/circle.dart';
import '../../../services/billing/feature_lock.dart';
import '../../../shared/widgets/dialog/kallo_confirm.dart';
import '../../../shared/widgets/toast/top_toast.dart';
import '../../logging/logic/open_logging_day.dart';
import '../data/invite_mutations.dart';

/// What a meal-share offer does when you act on it — the side effects, out of
/// the card that draws it.
///
/// Both return TRUE when the offer is resolved and the card is on its way out,
/// FALSE when it failed and the card should re-enable itself. Errors are
/// reported here rather than rethrown, because every caller reports them the
/// same way and the difference that matters (a 402 goes to the paywall) is a
/// detail of this layer, not of the widget.

/// Take the offer: log the copy, or — for a cheat occasion — reopen the
/// sender's sliders so the recipient sets their own amounts.
///
/// Either way this ends on the logging feed at the day the meal belongs to.
/// The copy carries the SOURCE meal's instant, so that is usually not today,
/// and a toast alone would point at a day the user is not looking at.
Future<bool> takeInviteOffer(
  BuildContext context,
  WidgetRef ref,
  MealShareInvite invite,
) async {
  try {
    if (invite.isCheat) {
      // Nobody can say what I ate from where THEY put the sliders, so this
      // stages their spec for me to adjust — it logs nothing yet.
      final loggedAt = await stageCheatMealShareInvite(ref, invite.id);
      if (!context.mounted) return true;
      goToLoggingDay(context, ref, loggedAt);
      return true;
    }
    final loggedAt = await acceptMealShareInvite(ref, invite.id);
    if (!context.mounted) return true;
    showTopToast(context, tr('groups.invites.accepted'));
    goToLoggingDay(context, ref, loggedAt);
    return true;
  } catch (error) {
    if (!context.mounted) return false;
    // Taking a cheat offer is gated (confirming a cheat meal always was), so
    // a 402 belongs at the paywall rather than in a "try again" toast for
    // something that can never succeed.
    if (!handledFeatureLock(context, error)) {
      _reportFailure(context);
    }
    return false;
  }
}

/// Decline the offer. Deliberately silent on success — a dismiss says nothing
/// to the sender and needs to say nothing to the reader either.
Future<bool> dismissInviteOffer(
  BuildContext context,
  WidgetRef ref,
  String inviteId,
) async {
  try {
    await dismissMealShareInvite(ref, inviteId);
    return true;
  } catch (_) {
    if (context.mounted) _reportFailure(context);
    return false;
  }
}

/// Ask before acting on an offer. Both answers are hard to take back from the
/// reader's side: accepting writes a meal into their diary (on the day it was
/// EATEN, usually not today) or spends a cheat offer on a slider card, and
/// dismissing removes it until the sender shares it again. The dismiss copy
/// says exactly that, so the reader knows the sender is not told and that it
/// is not permanent. The web twin is `invite-confirm-dialog.tsx`.
///
/// Returns false for every way out that is not the affirmative.
Future<bool> confirmInviteResponse(
  BuildContext context,
  MealShareInvite invite, {
  required bool dismiss,
}) {
  final kind =
      dismiss
          ? 'dismiss'
          : invite.isCheat
          ? 'acceptCheat'
          : 'accept';
  return showKalloConfirm(
    context,
    title: tr('groups.invites.confirm.${kind}Title'),
    description: tr(
      'groups.invites.confirm.${kind}Description',
      namedArgs: {'name': invite.from.label},
    ),
    confirmLabel: tr('groups.invites.confirm.${kind}Action'),
    cancelLabel: tr('groups.invites.confirm.cancel'),
    destructive: dismiss,
  );
}

void _reportFailure(BuildContext context) => showTopToast(
  context,
  tr('groups.invites.error'),
  variant: TopToastVariant.error,
);
