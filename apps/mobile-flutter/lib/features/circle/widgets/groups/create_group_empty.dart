import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/data/surface_cast.dart';
import '../../../../shared/widgets/feedback/kallo_surface_state.dart';
import '../../../../shared/widgets/surface/kallo_primitives.dart';

/// The create-group sheet with nobody to pick from: a group needs friends
/// first, so the one way forward is adding one — in the quiet tier, because
/// this is a starting point rather than a failure.
class CreateGroupEmpty extends StatelessWidget {
  const CreateGroupEmpty({required this.onAddFriend, super.key});
  final VoidCallback onAddFriend;

  @override
  Widget build(BuildContext context) => KalloSurfaceState(
    area: SurfaceArea.circle,
    kind: SurfaceKind.empty,
    compact: true,
    title: tr('groups.createGroup.emptyTitle'),
    subtitle: tr('groups.createGroup.noFriends'),
    action: KalloButton(
      title: tr('groups.createGroup.addFriendCta'),
      variant: KalloButtonVariant.secondary,
      onPressed: onAddFriend,
    ),
  );
}
