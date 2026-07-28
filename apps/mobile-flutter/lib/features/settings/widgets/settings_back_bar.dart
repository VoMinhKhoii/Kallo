import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_theme.dart';

/// The one back affordance every settings drill-in shares: an ArrowLeft plus
/// the parent page's name, left-aligned at the top of the screen.
///
/// It reads as the parent title *shrunk*, so the sub-page's own serif title
/// below it lands as a continuation of "Settings" rather than a new, centred
/// app bar.
///
/// It carries **no** bottom border and no fill: at rest the bar is the page.
/// The hairline is [ScrollSeparator]'s job and only appears once content has
/// scrolled under it — three always-on borders across the settings stack read
/// as clutter at rest.
class SettingsBackBar extends StatefulWidget {
  const SettingsBackBar({super.key, this.label, this.onBack});

  /// The parent page's name — defaults to "Settings".
  final String? label;

  /// Defaults to popping the enclosing (nested) navigator.
  final VoidCallback? onBack;

  @override
  State<SettingsBackBar> createState() => _SettingsBackBarState();
}

class _SettingsBackBarState extends State<SettingsBackBar> {
  bool _pressed = false;

  void _back() {
    final onBack = widget.onBack;
    if (onBack != null) {
      onBack();
      return;
    }
    Navigator.of(context).maybePop();
  }

  @override
  Widget build(BuildContext context) {
    final label = widget.label ?? tr('settings.title');
    // Text darkens on press (muted → ink) — the calm affordance, no fill.
    final color = _pressed ? kInk : kInkMuted;
    return Semantics(
      button: true,
      excludeSemantics: true,
      label: label,
      onTap: _back,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _back,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: NhamSpacing.sp4,
            vertical: NhamSpacing.sp3,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(LucideIcons.arrowLeft, size: 16, color: color),
              const SizedBox(width: 6),
              Text(
                label,
                style: dashBody(weight: FontWeight.w500, color: color),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
