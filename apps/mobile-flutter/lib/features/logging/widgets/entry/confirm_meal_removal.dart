import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';

import '../../../../shared/widgets/dialog/kallo_confirm.dart';

/// "Xoá bữa ăn này?" — the confirm behind both removal affordances on a SAVED
/// meal card (the trailing swipe and the trash action).
///
/// The chrome, the stacked buttons and the haptics all live in
/// [showKalloConfirm] now; this only names the copy. The affirmative is
/// `common.agree` rather than the verb "Xoá": beside "Huỷ" — which in
/// Vietnamese means both *cancel* and *destroy* — the two verbs read as the
/// same choice, which is the ambiguity this whole dialog was reported for.
Future<bool> confirmMealRemoval(BuildContext context) => showKalloConfirm(
  context,
  title: 'logging.removeConfirmTitle'.tr(),
  description: 'logging.removeConfirmDescription'.tr(),
  destructive: true,
);
