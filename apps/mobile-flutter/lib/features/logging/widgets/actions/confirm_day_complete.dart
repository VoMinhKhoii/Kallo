import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';

import '../../../../shared/logic/display_format.dart' show formatCount;
import '../../../../shared/widgets/dialog/kallo_confirm.dart';

/// "Mình ăn đủ rồi" — the user attesting that an under-logged day is in fact
/// everything they ate.
///
/// Not [destructive]: nothing is deleted, and red is reserved in this palette
/// for "something is gone", never for "your numbers are off". The fact that it
/// cannot be undone is carried by the body copy instead, which is where a user
/// actually reads it.
Future<bool> confirmDayComplete(BuildContext context, {required int calories}) {
  const t = 'logging.feedArea.partialDayNotice';
  return showKalloConfirm(
    context,
    title: '$t.confirmTitle'.tr(),
    description: '$t.confirmBody'.tr(
      namedArgs: {'calories': formatCount(calories, context.locale.toString())},
    ),
    confirmLabel: '$t.confirmAccept'.tr(),
    cancelLabel: '$t.confirmCancel'.tr(),
  );
}
