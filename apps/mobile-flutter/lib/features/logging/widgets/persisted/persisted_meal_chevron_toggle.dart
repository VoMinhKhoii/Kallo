import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/kallo_colors.dart';
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
      child: SizedBox(
        // Width only. As a 36pt SQUARE this box was taller than one line of
        // title, and centring the glyph inside it dropped the chevron below
        // the title's first line — obvious on the two- and three-line meal
        // texts this card is built for. Hugging the glyph's own height keeps
        // it level with line one; the card's whole block is the toggle target
        // anyway, so the target loses nothing that matters.
        width: LoggingIcons.hit,
        // Top-right: the glyph lands on the card's content edge (level with
        // the kcal below it) while the target keeps its width by extending
        // inward.
        child: Align(
          alignment: Alignment.topRight,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150), // transition-colors
            padding: const EdgeInsets.all(4), // p-1
            decoration: BoxDecoration(
              color: _pressed ? KalloColors.hover40 : Colors.transparent,
              shape: BoxShape.circle,
            ),
            child: RotationTransition(
              turns: Tween<double>(begin: 0, end: 0.5).animate(widget.expand),
              child: const Icon(
                LucideIcons.chevronDown300, // lucide ChevronDown
                // 20, between the card's 14pt text and the 24pt action row
                // below it, and muted: this is furniture ON the card, not one
                // of the card's actions.
                size: 20,
                color: KalloColors.textMuted,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
