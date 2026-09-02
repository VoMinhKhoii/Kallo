import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';

class CreateGroupEmpty extends StatelessWidget {
  const CreateGroupEmpty({required this.onAddFriend, super.key});
  final VoidCallback onAddFriend;

  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      children: [
        Text(
          tr('groups.createGroup.emptyTitle'),
          style: dashBody(),
        ),
        Text(
          tr('groups.createGroup.noFriends'),
          textAlign: TextAlign.center,
          style: dashMeta(),
        ),
        TextButton(
          onPressed: onAddFriend,
          child: Text(tr('groups.createGroup.addFriendCta')),
        ),
      ],
    ),
  );
}
