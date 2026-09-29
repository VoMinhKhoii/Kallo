import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';

import '../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../theme/kallo_theme.dart';

/// The group sheet when its detail failed to load: the close control, so the
/// sheet can still be dismissed, and a retry.
class GroupDetailError extends StatelessWidget {
  const GroupDetailError({required this.onRetry, super.key});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      const KalloSheetHeader(),
      CupertinoButton(
        onPressed: onRetry,
        child: Text(tr('groups.switcher.retry')),
      ),
      const SizedBox(height: KalloSpacing.sp6),
    ],
  );
}
