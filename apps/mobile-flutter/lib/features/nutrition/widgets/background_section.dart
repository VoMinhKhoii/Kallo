import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../features/dashboard/widgets/dashboard_tokens.dart';
import '../../../models/nutrition.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_typography.dart';
import 'nutrient_row.dart';

/// RN port of
/// `apps/mobile/src/components/nutrition/sections/background-section.tsx`. The
/// web AnimatePresence collapses height + opacity together (duration 0.3,
/// ease:[0.22,1,0.36,1]) on BOTH enter and exit, so a single controller drives
/// SizeTransition + FadeTransition forward (open) / reverse (close).
class BackgroundSection extends StatefulWidget {
  const BackgroundSection({super.key, required this.cards});

  final List<NutrientCardData> cards;

  @override
  State<BackgroundSection> createState() => _BackgroundSectionState();
}

class _BackgroundSectionState extends State<BackgroundSection>
    with SingleTickerProviderStateMixin {
  bool _open = false;

  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 300),
  );

  // Web ease:[0.22, 1, 0.36, 1] — expo-out style.
  late final Animation<double> _curve = CurvedAnimation(
    parent: _controller,
    curve: const Cubic(0.22, 1.0, 0.36, 1.0),
    reverseCurve: const Cubic(0.22, 1.0, 0.36, 1.0),
  );

  void _toggle() {
    setState(() => _open = !_open);
    if (_open) {
      _controller.forward();
    } else {
      _controller.reverse();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cards = widget.cards;
    if (cards.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text(
              tr('nutrition.background.eyebrow'),
              style: NhamTextStyles.sansMedium(fontSize: 14)
                  .copyWith(color: NhamColors.textMuted),
            ),
            const Spacer(),
            const SizedBox(width: 16),
            _ToggleButton(
              label: _open
                  ? tr('nutrition.background.hide')
                  : tr('nutrition.background.show',
                      namedArgs: {'count': cards.length.toString()}),
              onTap: _toggle,
            ),
          ],
        ),
        // Web AnimatePresence opacity + height collapse, duration 0.3, on both
        // enter and exit.
        SizeTransition(
          alignment: AlignmentDirectional.topStart,
          sizeFactor: _curve,
          child: FadeTransition(
            opacity: _curve,
            child: Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    tr('nutrition.background.hint'),
                    style: NhamTextStyles.sansRegular(fontSize: 11)
                        .copyWith(color: NhamColors.textMuted),
                  ),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(kCardRadius),
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(kCardRadius),
                        color: kCardSurface,
                        boxShadow: const [kCardShadow],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          for (final card in cards) NutrientRow(card: card),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Web: `font-medium text-xs text-nham-text` with `hover:underline` /
/// `focus-visible:underline` (underline-offset-4). On touch the affordance is a
/// pressed underline.
class _ToggleButton extends StatefulWidget {
  const _ToggleButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  State<_ToggleButton> createState() => _ToggleButtonState();
}

class _ToggleButtonState extends State<_ToggleButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: Text(
        widget.label,
        style: NhamTextStyles.sansMedium(fontSize: 12).copyWith(
          color: NhamColors.text,
          decoration: _pressed ? TextDecoration.underline : null,
          decorationColor: NhamColors.text,
          decorationThickness: 1,
        ),
      ),
    );
  }
}
