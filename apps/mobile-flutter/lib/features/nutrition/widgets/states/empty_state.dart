import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/data/surface_cast.dart';
import '../../../../shared/widgets/feedback/kallo_surface_state.dart';
import '../../../../shared/widgets/motion/fade_in_down.dart';
import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../shell/nav/nav_actions.dart';

/// The nutrition page with nothing logged in range: the shared surface state,
/// the sloth peeking out of its box, and the one way forward.
class EmptyState extends StatelessWidget {
  const EmptyState({super.key});

  @override
  Widget build(BuildContext context) {
    // Web motion.section opacity/y:8 duration 0.55 delay 0.1.
    return FadeInDown(
      duration: const Duration(milliseconds: 550),
      delay: const Duration(milliseconds: 100),
      child: KalloSurfaceState(
        area: SurfaceArea.nutrition,
        kind: SurfaceKind.empty,
        title: tr('nutrition.emptyV2.title'),
        subtitle: tr('nutrition.emptyV2.description'),
        // The black `cta`: the tier every surface state gives its one
        // action, the one sanctioned use of it outside auth and the paywall.
        // (The locked-micronutrients card next door wears the same black
        // pill for its own reason: it opens the paywall.)
        action: KalloButton(
          variant: KalloButtonVariant.cta,
          title: tr('nutrition.emptyV2.logMeal'),
          onPressed: () => goToLogging(context),
        ),
      ),
    );
  }
}
