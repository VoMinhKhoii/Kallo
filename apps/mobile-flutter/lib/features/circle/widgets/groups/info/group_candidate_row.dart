import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../models/social/circle.dart';
import '../../../../../shared/widgets/avatar/profile_avatar.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_theme.dart';
import 'group_member_row.dart';

/// A friend who could join the group: face, name, and the iOS round check on
/// the right — empty ring when unpicked, ink disc with a white tick when
/// picked. Same 56pt row and 36pt face as the member rows it becomes.
class GroupCandidateRow extends StatelessWidget {
  const GroupCandidateRow({
    required this.profile,
    required this.selected,
    required this.onTap,
    super.key,
  });

  final CircleProfile profile;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: profile.label,
      excludeSemantics: true,
      child: CupertinoButton(
        onPressed: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        padding: EdgeInsets.zero,
        minimumSize: const Size.square(KalloIcons.hit),
        child: Container(
          height: GroupMemberRow.height,
          padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp4),
          child: Row(
            children: [
              ProfileAvatarDisc(profile: profile, size: 36),
              const SizedBox(width: KalloSpacing.sp3),
              Expanded(
                child: Text(
                  profile.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: dashBody(),
                ),
              ),
              _Check(selected: selected),
            ],
          ),
        ),
      ),
    );
  }
}

class _Check extends StatelessWidget {
  const _Check({required this.selected});

  final bool selected;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      width: 24,
      height: 24,
      decoration: BoxDecoration(
        color: selected ? kInk : null,
        shape: BoxShape.circle,
        border: selected ? null : Border.all(color: kHairline, width: 1.5),
      ),
      child:
          selected
              ? const Icon(
                LucideIcons.check300,
                size: 15,
                color: CupertinoColors.white,
              )
              : null,
    );
  }
}
