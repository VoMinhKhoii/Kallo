import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../theme/kallo_colors.dart';
import '../../theme/kallo_gradients.dart';
import '../../theme/calm_tokens.dart';

/// The centre action is an ink plus on KalloGradients.brandSweep, the one
/// piece of nav chrome with its own shadow. The old flat beige btnPrimarySoft
/// read as chrome on a white capsule rather than the thing to tap. The
/// onboarding sweep's two hues at full opacity carry them at the phone's 52pt;
/// the aurora's alphas cannot be reused here.
///
/// A smaller side disc leaves room for its shadow within the capsule.
/// CupertinoTabBar cannot host this independent sheet action in a side
/// column; retire the custom target when the platform supports that slot.
class PillNavAddButton extends StatelessWidget {
  const PillNavAddButton({super.key, required this.onTap, required this.axis});

  final VoidCallback onTap;
  final Axis axis;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: tr('app.nav.add'),
    excludeSemantics: true,
    onTap: onTap,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: SizedBox(
        width: axis == Axis.vertical ? 56 : 64,
        height: axis == Axis.vertical ? 56 : kNavHeight,
        child: Center(
          child: Container(
            width: axis == Axis.vertical ? 44 : kNavAddSize,
            height: axis == Axis.vertical ? 44 : kNavAddSize,
            decoration: const BoxDecoration(
              // Gradient, not color: BoxDecoration takes one or the other.
              gradient: KalloGradients.brandSweep,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: Color(0x24141413),
                  blurRadius: 12,
                  offset: Offset(0, 4),
                ),
              ],
            ),
            child: Icon(
              LucideIcons.plus400,
              size: 24,
              color: KalloColors.onBrand,
            ),
          ),
        ),
      ),
    ),
  );
}
