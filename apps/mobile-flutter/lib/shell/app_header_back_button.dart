import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../theme/nham_colors.dart';
import '../theme/nham_theme.dart';

/// Left-slot back chevron — 44×44 hit area, radius 6, espresso glyph.
class AppHeaderBackButton extends StatefulWidget {
  const AppHeaderBackButton({required this.onBack, super.key});

  final VoidCallback onBack;

  @override
  State<AppHeaderBackButton> createState() => _AppHeaderBackButtonState();
}

class _AppHeaderBackButtonState extends State<AppHeaderBackButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: tr('common.back'),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        onTap: () {
          HapticFeedback.selectionClick();
          widget.onBack();
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          curve: Curves.easeInOut,
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: _pressed ? NhamColors.pressWash : null,
            borderRadius: BorderRadius.circular(NhamRadii.sm),
          ),
          child: const Icon(
            LucideIcons.chevronLeft,
            size: NhamIcons.size,
            color: NhamColors.text,
          ),
        ),
      ),
    );
  }
}
