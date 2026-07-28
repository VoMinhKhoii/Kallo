import 'package:flutter/material.dart';

import '../shared/widgets/kallo_wordmark.dart';
import '../theme/nham_colors.dart';
import '../theme/nham_theme.dart';

/// Drawer header — the brand wordmark, and nothing else.
///
/// The avatar / display-name / email block that used to sit under it is gone:
/// the drawer is a navigation surface, and repeating who you are on every open
/// is noise you already know. Identity lives in Settings → Profile, where it is
/// also editable. Dropping it lets the wordmark carry the header at a size that
/// actually reads as branding.
class SidebarHeader extends StatelessWidget {
  const SidebarHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        NhamSpacing.sp3,
        NhamSpacing.sp5,
        NhamSpacing.sp3,
        NhamSpacing.sp4,
      ),
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: NhamColors.borderBiscotti40, width: 1),
        ),
      ),
      child: const Align(
        alignment: Alignment.centerLeft,
        child: KalloWordmark(height: 26),
      ),
    );
  }
}
