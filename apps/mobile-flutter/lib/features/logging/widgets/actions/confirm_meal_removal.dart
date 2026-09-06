import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';

import '../../../../shared/widgets/dialog/kallo_confirm.dart';

/// "Xoá bữa ăn này?" — the confirm behind both removal affordances on a SAVED
/// meal card (the trailing swipe and the trash action).
///
/// The chrome, the stacked buttons and the haptics all live in
/// [showKalloConfirm] now; this only names the copy. Both options are verbs
/// (2026-09-03): "Xoá" against "Giữ lại", so neither button needs the title to
/// explain it. The earlier neutral pair went the other way — it removed "Xoá"
/// to avoid colliding with "Huỷ", which reads as *cancel* and *destroy* alike —
/// and cost the user the one word that said what would happen.
Future<bool> confirmMealRemoval(BuildContext context) => showKalloConfirm(
  context,
  title: 'logging.removeConfirmTitle'.tr(),
  description: 'logging.removeConfirmDescription'.tr(),
  confirmLabel: 'common.actions.remove'.tr(),
  cancelLabel: 'common.actions.keep'.tr(),
  destructive: true,
);

/// "Bỏ bữa ăn chưa lưu này?" — the confirm behind discarding a STAGED card.
///
/// Its own copy rather than [confirmMealRemoval]'s: nothing has been saved yet,
/// so "biến mất khỏi nhật ký" would overstate what is being lost, and the way
/// back is simply to type it again.
///
/// It lives beside its sibling because `widgets/entry/` is at the folder gate's
/// ten-file cap; the two confirms are one concern anyway.
Future<bool> confirmPendingDiscard(BuildContext context) => showKalloConfirm(
  context,
  title: 'logging.stagedMealCard.discardConfirmTitle'.tr(),
  description: 'logging.stagedMealCard.discardConfirmDescription'.tr(),
  confirmLabel: 'common.actions.discard'.tr(),
  cancelLabel: 'common.actions.keep'.tr(),
  destructive: true,
);
