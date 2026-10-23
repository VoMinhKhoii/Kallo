import 'package:flutter/material.dart';

import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';

/// Makes a dish row of an unconfirmed card a button: a press shows the warm
/// select wash, a tap opens the meal edit sheet on that dish.
///
/// The wash bleeds [_bleed] past the row on both sides so the name and the
/// macros keep their exact column — the row moves nothing when it lights up.
class MealEntryRowPress extends StatefulWidget {
  const MealEntryRowPress({
    super.key,
    required this.label,
    required this.onTap,
    required this.child,
  });

  /// What a screen reader announces, e.g. "Edit Salmon poke bowl".
  final String label;
  final VoidCallback onTap;
  final Widget child;

  @override
  State<MealEntryRowPress> createState() => _MealEntryRowPressState();
}

class _MealEntryRowPressState extends State<MealEntryRowPress> {
  static const double _bleed = 8;
  bool _pressed = false;

  void _press(bool value) => setState(() => _pressed = value);

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: widget.label,
      onTap: widget.onTap,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => _press(true),
        onTapUp: (_) => _press(false),
        onTapCancel: () => _press(false),
        onTap: widget.onTap,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned.fill(
              left: -_bleed,
              right: -_bleed,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                decoration: BoxDecoration(
                  color: _pressed ? KalloColors.hover40 : Colors.transparent,
                  borderRadius: BorderRadius.circular(KalloRadii.md),
                ),
              ),
            ),
            widget.child,
          ],
        ),
      ),
    );
  }
}
