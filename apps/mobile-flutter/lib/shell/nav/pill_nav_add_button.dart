import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../theme/kallo_colors.dart';
import '../../theme/kallo_gradients.dart';
import '../../theme/calm_tokens.dart';

/// The shared 52pt create disc; only its hit slot changes with the capsule.
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
        height: axis == Axis.vertical ? 60 : kNavHeight,
        child: Center(
          child: Container(
            width: kNavAddSize,
            height: kNavAddSize,
            decoration: const BoxDecoration(
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
