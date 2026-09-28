import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';

/// One choice in [showCircleActionSheet].
class CircleSheetAction<T> {
  const CircleSheetAction({
    required this.label,
    required this.value,
    this.destructive = false,
  });

  final String label;
  final T value;

  /// Red, for an action that takes something away (block, remove, leave).
  final bool destructive;
}

/// iOS's own action sheet for the Circle's quiet `⋯` menus and the report
/// reasons: an optional muted [title], the [actions], and a separate Cancel.
///
/// This is where the Circle's negative actions live. The list they are opened
/// from shows one muted glyph per row, so red appears only here, inside the
/// sheet, on the destructive rows — never as a column of red buttons down the
/// page.
///
/// Cupertino's sheet in the app's type, the same paint the avatar sheet
/// (`settings/widgets/profile/photo_action_sheet.dart`) sets: SF in system
/// blue is the platform's default, so each row sets Be Vietnam Pro in ink, or
/// danger red for a destructive one (`kallo-design/mobile.md`, *Where
/// Cupertino stops*).
Future<T?> showCircleActionSheet<T>(
  BuildContext context, {
  String? title,
  required List<CircleSheetAction<T>> actions,
}) => showCupertinoModalPopup<T>(
  context: context,
  builder:
      (sheetContext) => CupertinoActionSheet(
        title:
            title == null
                ? null
                : Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: dashMeta(),
                ),
        actions: [
          for (final action in actions)
            CupertinoActionSheetAction(
              isDestructiveAction: action.destructive,
              onPressed: () => Navigator.of(sheetContext).pop(action.value),
              child: Text(
                action.label,
                style:
                    action.destructive
                        ? dashBody(color: KalloColors.danger)
                        : dashBody(),
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
