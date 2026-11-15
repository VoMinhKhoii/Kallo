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
        leading: mirror ? const ProfileAvatarButton() : const SizedBox.shrink(),
        trailing:
            mirror ? const SizedBox.shrink() : const ProfileAvatarButton(),
        child: Align(
          alignment: mirror ? Alignment.centerRight : Alignment.centerLeft,
          child: const KalloWordmark(height: 26),
        ),
      ),
    );
  }
}
