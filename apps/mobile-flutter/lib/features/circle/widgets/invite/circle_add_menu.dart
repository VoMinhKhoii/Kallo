import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import 'add_friend_sheet.dart';
import '../groups/create_group_sheet.dart';

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
/// `popupMenuTheme` in `kallo_theme.dart` its radius, elevation, 48px rows and label
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
    // Pinned to the header's 44 slot: IconButton's own 48 default made this
    // 4pt wider than the leading menu button, which pushed the "centred" title
    // 2pt off centre. Glyph matches the menu at the app-wide 24.
    padding: EdgeInsets.zero,
    constraints: const BoxConstraints.tightFor(width: 44, height: 44),
    icon: const Icon(
      LucideIcons.userPlus300,
      size: KalloIcons.size,
      color: kInk,
    ),
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
