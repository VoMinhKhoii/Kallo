import 'package:flutter/material.dart';

import '../shared/widgets/kallo_wordmark.dart';
import '../theme/nham_colors.dart';
import '../theme/nham_theme.dart';
import '../theme/nham_typography.dart';

/// Drawer identity header — brand wordmark above the avatar + name + email
/// block, with the bottom hairline. Mirrors the web drawer's SheetHeader.
class SidebarHeader extends StatelessWidget {
  const SidebarHeader({required this.label, this.email, super.key});

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
          bottom: BorderSide(
            color: NhamColors.borderBiscotti40,
            width: 1,
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const KalloWordmark(height: 16),
          const SizedBox(height: NhamSpacing.sp4),
          Row(
            children: [
              _Avatar(initial: _deriveInitial(label, email)),
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
        ],
      ),
    );
  }
}

/// 44px gradient avatar with a soft accent ring + bold initial — anchors the
/// drawer's identity header.
class _Avatar extends StatelessWidget {
  const _Avatar({required this.initial});

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
            Color(0x66C9A87C), // accent @ 40%
            Color(0x8CE8E6DC), // border @ 55%
          ],
        ),
        border: Border.all(color: const Color(0x40C9A87C), width: 1),
      ),
      child: Text(
        initial,
        style: NhamTextStyles.sansBold(fontSize: 16).copyWith(
          color: NhamColors.btn,
        ),
      ),
    );
  }
}

String _deriveInitial(String label, String? email) {
  final source = label.trim().isNotEmpty ? label.trim() : (email ?? '');
  if (source.isEmpty) return '·';
  return source.characters.first.toUpperCase();
}
