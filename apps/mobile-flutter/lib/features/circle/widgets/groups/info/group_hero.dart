import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../models/social/chat_group.dart';
import '../../../../../shared/widgets/sheet/sheet_capsule_button.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_theme.dart';

/// The top of the group sheet under its header: the group's name, how many
/// are in it, and — for the owner — the way to rename it. The members' faces
/// sit in the header row above (`GroupInfoPage`).
///
/// The name lives HERE rather than in the sheet header (the contact-card
/// shape): the header holds only the close control and the faces, so the
/// name is never squeezed between two 44pt targets, and rename is a labelled capsule under
/// it instead of a lone pencil floating beside the title.
class GroupHero extends StatelessWidget {
  const GroupHero({required this.group, required this.onRename, super.key});

  final ChatGroupDetail group;

  /// Null hides the rename capsule — only the owner may rename.
  final VoidCallback? onRename;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          group.name ?? '',
          textAlign: TextAlign.center,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: kPageTitle(),
        ),
        const SizedBox(height: KalloSpacing.sp1),
        Text(
          tr(
            'groups.info.memberCount',
            namedArgs: {'count': '${group.members.length}'},
          ),
          style: dashMeta(),
        ),
        if (onRename != null) ...[
          const SizedBox(height: KalloSpacing.sp2),
          SheetCapsuleButton(
            label: tr('groups.info.renameLabel'),
            icon: LucideIcons.pencil300,
            onTap: onRename,
          ),
        ],
      ],
    );
  }
}
