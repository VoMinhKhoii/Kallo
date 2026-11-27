import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

import '../../../../theme/kallo_colors.dart';

/// A month chevron beside the calendar's title: a 20pt glyph in a 44pt
/// target, dimmed and inert when there is no month that way.
class LogMonthChevron extends StatelessWidget {
  const LogMonthChevron({
    super.key,
    required this.icon,
    required this.label,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    enabled: onTap != null,
    label: label,
    excludeSemantics: true,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap:
          onTap == null
              ? null
              : () {
                HapticFeedback.selectionClick();
                onTap!();
              },
      child: SizedBox(
        width: 44,
        height: 44,
        child: Icon(
          icon,
          size: 20,
          color: onTap == null ? KalloColors.stone50 : KalloColors.text,
        ),
      ),
    ),
  );
}
