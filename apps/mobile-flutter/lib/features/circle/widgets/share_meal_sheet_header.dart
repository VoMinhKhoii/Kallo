import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';

class ShareMealSheetHeader extends StatelessWidget {
  const ShareMealSheetHeader({required this.onClose, super.key});

  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        NhamSpacing.sp2,
        NhamSpacing.sp2,
        NhamSpacing.sp2,
        NhamSpacing.sp1,
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: onClose,
            icon: const Icon(LucideIcons.x, size: 22),
            color: NhamColors.textMuted,
            tooltip: tr('groups.invite.cancel'),
          ),
          Expanded(
            child: Center(
              child: Text(
                tr('groups.shareMeal.title'),
                style: NhamTextStyles.serifRegular(
                  fontSize: NhamFontSize.h4,
                ).copyWith(color: NhamColors.text),
              ),
            ),
          ),
          const SizedBox(width: 48, height: 48),
        ],
      ),
    );
  }
}
