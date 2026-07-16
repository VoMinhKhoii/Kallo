import 'package:flutter/material.dart';

import '../theme/nham_colors.dart';
import '../theme/nham_theme.dart';
import '../theme/nham_typography.dart';

class SidebarAccountHeader extends StatelessWidget {
  const SidebarAccountHeader({required this.label, this.email, super.key});

  final String label;
  final String? email;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        NhamSpacing.sp4,
        NhamSpacing.sp5,
        NhamSpacing.sp4,
        NhamSpacing.sp4,
      ),
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: NhamColors.borderBiscotti40, width: 1),
        ),
      ),
      child: Row(
        children: [
          Avatar(initial: _deriveInitial(label, email)),
          const SizedBox(width: NhamSpacing.sp3),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: NhamTextStyles.sansSemiBold(
                    fontSize: 16,
                  ).copyWith(color: NhamColors.text),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (email != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    email!,
                    style: NhamTextStyles.sansRegular(
                      fontSize: 12,
                    ).copyWith(color: NhamColors.textMuted),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// 44px gradient avatar with a soft accent ring + bold initial — anchors the
/// drawer's identity header.
class Avatar extends StatelessWidget {
  const Avatar({required this.initial, super.key});

  final String initial;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 44,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0x66C9A87C),
            Color(0x8CE8D5B5),
          ],
        ),
        border: Border.all(color: const Color(0x40C9A87C), width: 1),
      ),
      child: Text(
        initial,
        style: NhamTextStyles.sansBold(
          fontSize: 16,
        ).copyWith(color: NhamColors.btn),
      ),
    );
  }
}

String _deriveInitial(String label, String? email) {
  final source = label.trim().isNotEmpty ? label.trim() : (email ?? '');
  if (source.isEmpty) return '·';
  return source.characters.first.toUpperCase();
}
