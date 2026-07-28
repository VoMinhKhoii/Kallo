import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/nham_sheet.dart';
import '../../../theme/calm_tokens.dart';
import 'add_friend_sheet.dart';
import 'create_group_sheet.dart';

Future<void> showCreateGroupSheet(BuildContext context) => showNhamSheet<void>(
  context,
  isScrollControlled: true,
  builder: (_) => const CreateGroupSheet(),
);

enum _AddAction { friend, group }

/// The circle header's add control: one quiet icon that opens a native action
/// sheet offering "Add friend" / "Create group".
///
/// This was the app's ONLY `PopupMenuButton`, and it showed: with no
/// `popupMenuTheme` in `nham_theme.dart` its radius, elevation, 48px rows and label
/// type were raw Material defaults, so the menu read as a different product
/// from every other chooser here. Everywhere else the app either opens its own
/// bottom sheet ([showNhamSheet]) or, for "pick one action", a
/// [CupertinoActionSheet] (see settings → account). A two-item chooser that
/// itself leads to a bottom sheet is exactly that case, so it uses the
/// Cupertino sheet: native dismissal and iOS chrome, with the labels pinned to
/// the calm scale rather than Material's `TextTheme`.
class CircleAddMenu extends StatelessWidget {
  const CircleAddMenu({super.key});

  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: tr('groups.page.addFriend'),
    onPressed: () => _openActions(context),
    icon: const Icon(LucideIcons.userPlus, size: 18, color: kInk),
  );

  Future<void> _openActions(BuildContext context) async {
    HapticFeedback.lightImpact(); // sheet-open cue, as in settings
    final action = await showCupertinoModalPopup<_AddAction>(
      context: context,
      builder: (sheetContext) => CupertinoActionSheet(
        actions: [
          CupertinoActionSheetAction(
            onPressed: () => Navigator.of(sheetContext).pop(_AddAction.friend),
            child: Text(tr('groups.page.addFriend'), style: dashBody()),
          ),
          CupertinoActionSheetAction(
            onPressed: () => Navigator.of(sheetContext).pop(_AddAction.group),
            child: Text(tr('groups.page.createGroup'), style: dashBody()),
          ),
        ],
        cancelButton: CupertinoActionSheetAction(
          onPressed: () => Navigator.of(sheetContext).pop(),
          child: Text(
            tr('common.cancel'),
            style: dashBody(weight: FontWeight.w500),
          ),
        ),
      ),
    );
    if (action == null || !context.mounted) return;
    switch (action) {
      case _AddAction.friend:
        await showAddFriendSheet(context);
      case _AddAction.group:
        await showCreateGroupSheet(context);
    }
  }
}
