import 'package:flutter/material.dart';

import '../../../shell/app_header.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';

/// The settings tab's ONE top bar.
///
/// The root and every drill-in render the identical [AppHeader] — same back
/// affordance, same 44×44 slots, same horizontal inset — so navigating never
/// changes the bar's shape. The only thing that morphs is [title]: "Settings"
/// at the root, the section's own name inside it. Because the title lives here,
/// no sub-page repeats it in the body.
///
/// It carries **no** bottom border and no fill: at rest the bar is the page.
/// The hairline is [ScrollSeparator]'s job and only appears once content has
/// scrolled under it, so keep this in the `header` slot of one.
class SettingsHeader extends StatelessWidget {
  const SettingsHeader({super.key, required this.title, this.onBack});

  /// Center-slot text — the current screen's name.
  final String title;

  /// Defaults to popping the enclosing (nested) settings navigator, so a
  /// drill-in's back goes up one level instead of closing the tab.
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return Padding(
      // The app-wide root inset (dashboard, logging, circle) — the bar starts
      // exactly where every other tab's header does.
      padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp3),
      child: AppHeader(
        onBack: onBack ?? () => Navigator.of(context).maybePop(),
        child: Text(
          title,
          textAlign: TextAlign.center,
          style: dashHeadline(),
        ),
      ),
    );
  }
}
