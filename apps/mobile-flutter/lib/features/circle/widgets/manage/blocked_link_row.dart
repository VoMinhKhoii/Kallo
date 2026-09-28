import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';

/// "Blocked (2) ›" at the foot of the Friends tab — the way back to someone
/// the viewer blocked. Muted, because it is housekeeping rather than a friend,
/// and present only while the list has someone in it.
class BlockedLinkRow extends StatelessWidget {
  const BlockedLinkRow({super.key, required this.count, required this.onTap});

  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final label = tr(
      'groups.manage.blockedRow',
      namedArgs: {'count': '$count'},
    );
    return Semantics(
      button: true,
      excludeSemantics: true,
      label: label,
      onTap: onTap,
      child: CupertinoButton(
        minimumSize: const Size.square(KalloIcons.hit),
        padding: EdgeInsets.zero,
        onPressed: onTap,
        child: Row(
          children: [
            Expanded(child: Text(label, style: dashMeta())),
            const Icon(
              LucideIcons.chevronRight300,
              size: KalloIcons.tertiary,
              color: kInkMuted,
            ),
          ],
        ),
      ),
    );
  }
}
