import 'package:flutter/cupertino.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';

/// The pending action replaces the value and disclosure, rather than joining them.
class ListRowTrailing extends StatelessWidget {
  const ListRowTrailing({
    super.key,
    required this.busy,
    this.value,
    this.trailing,
    required this.showChevron,
  });
  final bool busy;
  final String? value;
  final Widget? trailing;
  final bool showChevron;
  @override
  Widget build(BuildContext context) {
    // A row waiting on its own action shows the spinner INSTEAD of its
    // value/chevron — the affordance it replaces is exactly what is pending.
    if (busy) {
      return CupertinoActivityIndicator(radius: 7, color: kInkMuted);
    }
    final List<Widget> parts = [
      if (value != null) Text(value!, style: dashMeta(tabular: true)),
      if (trailing != null) trailing!,
      if (showChevron)
        // Disclosure chevrons join the tertiary tier (18) rather than keeping
        // a private 16 (Threads icon tiers, 2026-09-01): beside a 16pt row
        // label a 16pt chevron read as a speck.
        Icon(
          LucideIcons.chevronRight300,
          size: KalloIcons.tertiary,
          color: kInkMuted,
        ),
    ];
    if (parts.isEmpty) return const SizedBox.shrink();
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < parts.length; i++) ...[
          if (i > 0) const SizedBox(width: KalloSpacing.sp2),
          parts[i],
        ],
      ],
    );
  }
}
