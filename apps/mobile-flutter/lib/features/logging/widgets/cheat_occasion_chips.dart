import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../models/cheat.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../data/logging_providers.dart';

/// "Log it again" chips — recent de-duplicated cheat occasions, shown above the
/// composer while in cheat mode. Tapping re-stages that occasion's sliders
/// (seeded with last time's amounts) without an AI call.
///
/// Ported from `components/logging/feed/cheat/cheat-occasion-chips.tsx`;
/// renders nothing while loading, on error, or with no past occasions.
class CheatOccasionChips extends ConsumerWidget {
  const CheatOccasionChips({
    super.key,
    required this.userId,
    required this.disabled,
    required this.onSelect,
  });

  final String userId;
  final bool disabled;
  final ValueChanged<RecentCheatOccasion> onSelect;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final occasions =
        ref.watch(recentCheatOccasionsProvider(userId)).valueOrNull ??
        const <RecentCheatOccasion>[];
    if (occasions.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: KalloSpacing.sp2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 6),
            child: Text(
              'logging.cheatRepeat.title'.tr().toUpperCase(),
              style: dashMeta(),
            ),
          ),
          Wrap(
            spacing: KalloSpacing.sp2,
            runSpacing: KalloSpacing.sp2,
            children: [
              for (final occasion in occasions)
                _OccasionChip(
                  occasion: occasion,
                  disabled: disabled,
                  onTap: () => onSelect(occasion),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _OccasionChip extends StatefulWidget {
  const _OccasionChip({
    required this.occasion,
    required this.disabled,
    required this.onTap,
  });

  final RecentCheatOccasion occasion;
  final bool disabled;
  final VoidCallback onTap;

  @override
  State<_OccasionChip> createState() => _OccasionChipState();
}

class _OccasionChipState extends State<_OccasionChip> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: !widget.disabled,
      label: widget.occasion.rawInput,
      child: Opacity(
        opacity: widget.disabled ? 0.5 : 1,
        child: GestureDetector(
          onTapDown:
              widget.disabled ? null : (_) => setState(() => _pressed = true),
          onTapUp:
              widget.disabled ? null : (_) => setState(() => _pressed = false),
          onTapCancel:
              widget.disabled ? null : () => setState(() => _pressed = false),
          onTap:
              widget.disabled
                  ? null
                  : () {
                    HapticFeedback.selectionClick();
                    widget.onTap();
                  },
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            constraints: const BoxConstraints(maxWidth: 224),
            padding: const EdgeInsets.symmetric(
              horizontal: KalloSpacing.sp3,
              vertical: 6,
            ),
            decoration: BoxDecoration(
              color: _pressed ? KalloColors.hover40 : KalloColors.elev,
              borderRadius: BorderRadius.circular(KalloRadii.pill),
              border: Border.all(
                color: _pressed ? KalloColors.accent60 : KalloColors.borderSoft,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  LucideIcons.cookie300,
                  size: 12,
                  color: KalloColors.textMuted,
                ),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    widget.occasion.rawInput,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: dashMeta(color: kInk),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
