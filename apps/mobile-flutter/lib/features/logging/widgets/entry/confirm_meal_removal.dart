import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../theme/kallo_colors.dart';

Future<bool> confirmMealRemoval(BuildContext context) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder:
        (dialogContext) => AlertDialog(
          title: Text('logging.removeConfirmTitle'.tr()),
          content: Text('logging.removeConfirmDescription'.tr()),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: Text('common.cancel'.tr()),
            ),
            TextButton(
              style: TextButton.styleFrom(foregroundColor: KalloColors.danger),
              onPressed: () {
                HapticFeedback.mediumImpact();
                Navigator.pop(dialogContext, true);
              },
              child: Text('logging.remove'.tr()),
            ),
          ],
        ),
  );

  return confirmed ?? false;
}
