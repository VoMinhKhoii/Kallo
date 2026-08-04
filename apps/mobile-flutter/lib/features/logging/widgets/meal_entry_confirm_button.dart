import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';

class MealEntryConfirmButton extends StatefulWidget {
  const MealEntryConfirmButton({
    super.key,
    required this.editing,
    required this.disabled,
    required this.onTap,
  });

  final bool editing;
  final bool disabled;
  final VoidCallback? onTap;

  @override
  State<MealEntryConfirmButton> createState() => _MealEntryConfirmButtonState();
}

class _MealEntryConfirmButtonState extends State<MealEntryConfirmButton> {
  bool _pressed = false;

  static const Color _btn5 = Color(0x0D695E4E); // btn umber @ 5%

  @override
  Widget build(BuildContext context) {
    final editing = widget.editing;
    final tappable = widget.onTap != null;
    final active = _pressed && tappable;
    final fg = editing ? NhamColors.btn : Colors.white;

    final Color bg;
    if (editing) {
      bg = active ? _btn5 : Colors.transparent;
    } else {
      bg = active ? NhamColors.btnHover : NhamColors.btn;
    }
    final BoxBorder? border =
        editing
            ? Border.all(
              color: active ? NhamColors.btn : NhamColors.btnBorderGhost,
            )
            : null;
    final List<BoxShadow>? shadow =
        editing ? null : [active ? NhamShadows.md : NhamShadows.sm];

    return Semantics(
      button: true,
      enabled: tappable,
      excludeSemantics: true,
      label: 'logging.confirm'.tr(),
      onTap: widget.onTap,
      child: Opacity(
        opacity: widget.disabled ? 0.5 : 1, // opacity-50
        child: GestureDetector(
          onTapDown: tappable ? (_) => setState(() => _pressed = true) : null,
          onTapUp: tappable ? (_) => setState(() => _pressed = false) : null,
          onTapCancel: tappable ? () => setState(() => _pressed = false) : null,
          onTap: widget.onTap,
          child: AnimatedContainer(
            duration: const Duration(
              milliseconds: 200,
            ), // transition-all duration-200
            padding: const EdgeInsets.symmetric(
              vertical: 10,
              horizontal: 12,
            ), // py-2.5 px-3
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(NhamRadii.xl), // rounded-xl
              border: border,
              boxShadow: shadow,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(LucideIcons.check300, size: 14, color: fg),
                const SizedBox(width: 6), // gap-1.5
                Text(
                  'logging.confirm'.tr(),
                  style: dashBody(color: fg, weight: FontWeight.w500),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Card: rounded-2xl (16px), border/60 hairline, shadow.sm, padding 16.
/// [color] lets the reveal match the streaming card's surface background.
