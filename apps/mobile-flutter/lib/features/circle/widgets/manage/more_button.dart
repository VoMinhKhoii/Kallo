import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';

/// The row's one way into its negative actions: a muted `⋯` at the tertiary
/// size on the app's 44pt target, opening an action sheet.
///
/// Quiet on purpose. Report, block and remove have to be there for the App
/// Store (guideline 1.2), but a column of red buttons down a list of friends
/// reads as hostile; red lives inside the sheet, on the rows that take
/// something away.
class MoreButton extends StatelessWidget {
  const MoreButton({super.key, required this.name, required this.onPressed});

  /// Whose menu this is, for VoiceOver: "More for Linh", not a bare "More".
  final String name;

  /// Null turns the button off — a row whose person or group has just gone,
  /// kept on screen only until its list refetches.
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      excludeSemantics: true,
      label: tr('groups.manage.more', namedArgs: {'name': name}),
      onTap: onPressed,
      child: CupertinoButton(
        minimumSize: const Size.square(KalloIcons.hit),
        padding: EdgeInsets.zero,
        onPressed: onPressed,
        child: const Icon(
          LucideIcons.ellipsis300,
          size: KalloIcons.tertiary,
          color: kInkMuted,
        ),
      ),
    );
  }
}
