import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';

const List<String> _goals = ['cutting', 'maintaining', 'bulking'];

/// The three-segment goal toggle — web `grid-cols-3 rounded-xl bg-[#EAE7E0]/50
/// p-1` inside `goal-tuning.tsx`.
class GoalStrip extends StatelessWidget {
  const GoalStrip({super.key, required this.value, required this.onChange});

  final String value;
  final ValueChanged<String> onChange;

  @override
  Widget build(BuildContext context) {
    final labels = {
      'maintaining': tr('onboarding.bodyMetrics.maintaining'),
      'cutting': tr('onboarding.bodyMetrics.cutting'),
      'bulking': tr('onboarding.bodyMetrics.bulking'),
    };
    return Container(
      padding: const EdgeInsets.all(KalloSpacing.sp1),
      decoration: BoxDecoration(
        color: const Color(0x80E8E6DC), // hairline @50%
        borderRadius: BorderRadius.circular(KalloRadii.buttonXl),
      ),
      child: Row(
        children: [
          for (var i = 0; i < _goals.length; i++) ...[
            if (i > 0) const SizedBox(width: KalloSpacing.sp1),
            Expanded(
              child: _GoalButton(
                label: labels[_goals[i]]!,
                active: value == _goals[i],
                onTap: () => onChange(_goals[i]),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _GoalButton extends StatefulWidget {
  const _GoalButton({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  State<_GoalButton> createState() => _GoalButtonState();
}

class _GoalButtonState extends State<_GoalButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    // active bg-white #2C2416 shadow-sm; inactive #8B8682 + hover:text-#2C2416.
    final color = widget.active ? kInk : (_pressed ? kInk : kInkMuted);
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        curve: const Cubic(0.25, 0.1, 0.25, 1),
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(
          vertical: KalloSpacing.sp1_5, // py-1.5
          horizontal: KalloSpacing.sp3, // px-3
        ),
        decoration:
            widget.active
                ? BoxDecoration(
                  color: KalloColors.elev,
                  borderRadius: BorderRadius.circular(KalloRadii.md),
                  boxShadow: const [KalloShadows.sm], // shadow-sm
                )
                : const BoxDecoration(),
        child: Text(
          widget.label,
          style: dashBody(color: color, weight: FontWeight.w500),
        ),
      ),
    );
  }
}
