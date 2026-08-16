import 'package:flutter/material.dart';

import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';

/// RN port of `components/onboarding/wizard/step-indicator.tsx`.
///
/// Active pill is wide (24px), completed/active are dark (`text`), future is
/// faint (`inputBorder`). The width change animates over 300ms (RN's
/// `LinearTransition.duration(300)`) via an [AnimatedContainer].
class StepIndicator extends StatelessWidget {
  const StepIndicator({
    super.key,
    required this.currentStep,
    required this.totalSteps,
  });

  final int currentStep;
  final int totalSteps;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var step = 1; step <= totalSteps; step++) ...[
          if (step > 1) const SizedBox(width: 6),
          _Pill(
            active: step == currentStep,
            done: step < currentStep,
          ),
        ],
      ],
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.active, required this.done});

  final bool active;
  final bool done;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      // Tailwind transition-all default easing: cubic-bezier(0.25,0.1,0.25,1).
      curve: const Cubic(0.25, 0.1, 0.25, 1),
      width: active ? 24 : 8,
      height: 6,
      decoration: BoxDecoration(
        color: active || done ? KalloColors.text : KalloColors.inputBorder,
        borderRadius: BorderRadius.circular(KalloRadii.pill),
      ),
    );
  }
}
