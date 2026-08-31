import 'package:flutter/material.dart';

import '../../../../shell/header/app_header_back_button.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';

/// The settings stack's ONE top bar: a 44×44 back chevron with the page title
/// on the same line, 28/700 (`kPageTitle`) in ink.
///
/// The root and every drill-in render the identical bar — same back
/// affordance, same slot, same inset — so navigating never changes its shape.
/// The only thing that morphs is [title]: "Settings" at the root, the
/// section's own name inside it. Because the title lives here, no sub-page
/// repeats it in the body.
///
/// The title is LEFT-aligned beside the chevron rather than centred between
/// two 44pt slots (native pass, 2026-08-31): at 28/700 it is the page's
/// headline, not chrome, and a headline that size centred over a back button
/// reads as a modal's title bar. The 44pt slot is pulled out to the screen
/// edge by the page's own 12pt inset so the glyph is optically flush while its
/// hit target stays square.
///
/// It carries **no** bottom border and no fill: at rest the bar is the page.
/// The hairline is [ScrollSeparator]'s job and only appears once content has
/// scrolled under it, so keep this in the `header` slot of one.
class SettingsHeader extends StatelessWidget {
  const SettingsHeader({super.key, required this.title, this.onBack});

  /// The current screen's name.
  final String title;

  /// Defaults to popping the enclosing (nested) settings navigator, so a
  /// drill-in's back goes up one level instead of closing the screen.
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return Padding(
      // The app-wide root inset, minus the 12 the back slot reclaims so the
      // chevron sits where the artboard puts it.
      padding: const EdgeInsets.only(bottom: KalloSpacing.sp1),
      child: Row(
        children: [
          AppHeaderBackButton(
            onBack: onBack ?? () => Navigator.of(context).maybePop(),
          ),
          const SizedBox(width: KalloSpacing.sp1),
          Expanded(
            child: Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: kPageTitle(),
            ),
          ),
          const SizedBox(width: KalloSpacing.sp3),
        ],
      ),
    );
  }
}
