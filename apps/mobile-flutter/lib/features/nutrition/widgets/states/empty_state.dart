import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/widgets/feedback/kallo_empty_state.dart';
import '../../../../shared/widgets/brand/seed_mark.dart';
import '../../../../shared/widgets/motion/fade_in_down.dart';
import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../shell/nav/nav_actions.dart';

/// The nutrition page with nothing logged in range: the shared empty-state
/// template, a sprouting-seed mark, and the one way forward.
class EmptyState extends StatelessWidget {
  const EmptyState({super.key});

  @override
  Widget build(BuildContext context) {
    // Web motion.section opacity/y:8 duration 0.55 delay 0.1.
    return FadeInDown(
      duration: const Duration(milliseconds: 550),
      delay: const Duration(milliseconds: 100),
      child: KalloEmptyState(
        mark: const SeedMark(),
        title: tr('nutrition.emptyV2.title'),
        description: tr('nutrition.emptyV2.description'),
        // The in-app primary: beige + ink. [KalloEmptyStateAction]'s black
        // pill is the CTA variant, which is reserved for auth and paywall —
        // "Log a meal" is neither. (The locked-micronutrients card next door
        // keeps the black pill: it opens the paywall.)
        action: KalloButton(
          title: tr('nutrition.emptyV2.logMeal'),
          onPressed: () => goToLogging(context),
        ),
      ),
    );
  }
}
