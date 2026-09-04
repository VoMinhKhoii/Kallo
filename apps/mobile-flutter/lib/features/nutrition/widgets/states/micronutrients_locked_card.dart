import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../services/billing/feature_lock.dart';
import '../../../../shared/widgets/feedback/kallo_surface_state.dart';
import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../shared/widgets/motion/fade_in_down.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';

/// Stands in for the vitamin and mineral grids when the account isn't entitled
/// to micronutrients (`micronutrientsLocked` on the overview — the server has
/// already emptied those sections, and this is what the reader gets instead).
///
/// Calories and macros above it stay visible: only the nutrient detail is
/// premium. Built on the app's one surface-state anatomy rather than a bespoke
/// upsell panel, so a locked page reads like the rest of the product — with
/// its own padlock in place of a cast pose, because the lock IS the message.
class MicronutrientsLockedCard extends StatelessWidget {
  const MicronutrientsLockedCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      // The page's one step, like every other gap on it.
      padding: const EdgeInsets.only(top: KalloSpacing.sp3),
      child: FadeInDown(
        duration: const Duration(milliseconds: 550),
        delay: const Duration(milliseconds: 100),
        child: KalloSurfaceState.withMark(
          mark: const Icon(
            LucideIcons.lock300,
            size: KalloIcons.primary,
            color: kInkMuted,
          ),
          title: tr('nutrition.locked.title'),
          subtitle: tr('nutrition.locked.description'),
          // The one black pill left on this page: it opens the paywall.
          action: KalloButton(
            title: tr('nutrition.locked.cta'),
            variant: KalloButtonVariant.cta,
            onPressed: () => openPaywall(context),
          ),
        ),
      ),
    );
  }
}
