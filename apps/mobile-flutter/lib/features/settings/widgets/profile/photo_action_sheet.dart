import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';

/// What the person chose from the photo sheet.
enum PhotoAction { pick, remove }

/// iOS's own action sheet for the avatar: pick a photo, remove the current
/// one (red, and only when there is a custom one to remove), and a separate
/// Cancel — the native answer to "Sửa ảnh", where the screen used to carry
/// two pill buttons beside the avatar for choices most visits never make.
///
/// Cupertino's sheet, wearing the app's type: its default label style is SF
/// in system blue, so each action sets Be Vietnam Pro in ink (danger red for
/// the destructive one) — the platform owns the anatomy, the design system
/// owns the paint (`kallo-design/mobile.md`, *Where Cupertino stops*).
Future<PhotoAction?> showPhotoActions(
  BuildContext context, {
  required bool hasCustomAvatar,
}) => showCupertinoModalPopup<PhotoAction>(
  context: context,
  builder:
      (sheetContext) => CupertinoActionSheet(
        actions: [
          CupertinoActionSheetAction(
            onPressed: () => Navigator.of(sheetContext).pop(PhotoAction.pick),
            child: Text(
              tr(
                hasCustomAvatar
                    ? 'settings.identity.avatarChange'
                    : 'settings.identity.avatarUpload',
              ),
              style: dashBody(),
            ),
          ),
          if (hasCustomAvatar)
            CupertinoActionSheetAction(
              isDestructiveAction: true,
              onPressed:
                  () => Navigator.of(sheetContext).pop(PhotoAction.remove),
              child: Text(
                tr('settings.identity.avatarRemove'),
                style: dashBody(color: KalloColors.danger),
              ),
            ),
        ],
        cancelButton: CupertinoActionSheetAction(
          isDefaultAction: true,
          onPressed: () => Navigator.of(sheetContext).pop(),
          child: Text(tr('common.cancel'), style: kButtonLabel()),
        ),
      ),
);
