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

  /// Null when the count could not be loaded: the row then reads just
  /// "Blocked", and the list it opens shows the error with a retry.
  final int? count;
  final VoidCallback onTap;

  /// The row's height — the 44pt target — for a layout that has to leave
  /// room for it under a centred state.
  static const double extent = KalloIcons.hit;

  @override
  Widget build(BuildContext context) {
    final label =
        count == null
            ? tr('groups.manage.blockedTitle')
            : tr('groups.manage.blockedRow', namedArgs: {'count': '$count'});
    return Semantics(
      button: true,
      excludeSemantics: true,
      label: label,
      onTap: onTap,
      child: CupertinoButton(
        minimumSize: const Size.square(extent),
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
