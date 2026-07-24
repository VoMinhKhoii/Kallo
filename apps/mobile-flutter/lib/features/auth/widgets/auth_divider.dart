import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';

/// "or continue with email" divider.
///
/// Matches web `components/auth/auth-dialog.tsx:89-98`: two `h-px flex-1
/// bg-[#E8E6DC]/60` rules flanking a `text-xs text-[#8B7355]` label, `gap-3`
/// (12) around the label. No vertical margin — the parent stack (`space-y-3`)
/// owns the surrounding spacing.
class AuthDivider extends StatelessWidget {
  const AuthDivider({super.key});

  @override
  Widget build(BuildContext context) {
    final rule = Expanded(
      child: Container(height: 1, color: NhamColors.borderSoft),
    );
    return Row(
      children: [
        rule,
        const SizedBox(width: 12), // gap-3
        Text(
          tr('auth.dialog.orContinueWithEmail'),
          style: dashMeta(),
        ),
        const SizedBox(width: 12),
        rule,
      ],
    );
  }
}
