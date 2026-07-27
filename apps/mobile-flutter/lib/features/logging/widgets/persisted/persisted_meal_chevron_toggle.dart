import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/nham_colors.dart';
import '../../logic/logging_spacing.dart';

/// The collapse chevron: its OWN button — a round pressed wash sized to the
/// glyph, not to the row. Rotates 0°↔180° over 200ms.
class PersistedMealChevronToggle extends StatefulWidget {
  const PersistedMealChevronToggle({
    super.key,
    required this.expand,
    required this.onTap,
  });

  final Animation<double> expand;
  final VoidCallback onTap;

  @override
  State<PersistedMealChevronToggle> createState() =>
      _PersistedMealChevronToggleState();
}

class _PersistedMealChevronToggleState
    extends State<PersistedMealChevronToggle> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      // The tap target is the full [LoggingIcons.hit] square; the wash inside
      // stays hugging the glyph, so the target grows without the press
      // affordance ballooning with it.
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: SizedBox.square(
        dimension: LoggingIcons.hit,
        // Right-aligned, not centred: the glyph lands on the card's content
        // edge (level with the kcal below it) while the 36pt target keeps its
        // size by extending inward.
        child: Align(
          alignment: Alignment.centerRight,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150), // transition-colors
            padding: const EdgeInsets.all(4), // p-1
            decoration: BoxDecoration(
              color: _pressed ? NhamColors.hover40 : Colors.transparent,
              shape: BoxShape.circle,
            ),
            child: RotationTransition(
              turns: Tween<double>(begin: 0, end: 0.5).animate(widget.expand),
              child: const Icon(
                LucideIcons.chevronDown, // lucide ChevronDown
                // Same glyph size and ink as the action icons beneath the card.
                size: LoggingIcons.size,
                color: NhamColors.text,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
