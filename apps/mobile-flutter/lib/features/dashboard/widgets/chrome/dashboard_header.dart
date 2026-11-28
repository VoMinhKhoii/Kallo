import 'package:flutter/widgets.dart';
import '../../../../shared/widgets/brand/kallo_wordmark.dart';
import '../../../../shell/header/app_header.dart';
import '../../../../shell/header/profile_avatar_button.dart';
import '../../../../shell/window/window_layout.dart';

/// Identity stays in the far pane when the control column changes sides.
class DashboardHeader extends StatelessWidget {
  const DashboardHeader({super.key});

  @override
  Widget build(BuildContext context) {
    final layout = WindowLayout.of(context);
    final mirror = layout.mirrored;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: AppHeader(
        // Collapsing the empty leading slot puts the wordmark on the page
        // inset rather than 44pt behind a spacer. Mirror with the pane.
        leading: mirror ? const ProfileAvatarButton() : const SizedBox.shrink(),
        // Settings moved behind the avatar when the drawer retired.
        trailing:
            mirror ? const SizedBox.shrink() : const ProfileAvatarButton(),
        child: Align(
          alignment: mirror ? Alignment.centerRight : Alignment.centerLeft,
          // Optical masthead height, matching the serif header it replaced.
          child: const KalloWordmark(height: 26),
        ),
      ),
    );
  }
}
