import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../../../theme/calm_tokens.dart';
import '../../../../../../../theme/kallo_colors.dart';
import '../../../../../../../theme/kallo_theme.dart';

/// "− value +" — the Amount row's control: two grey round buttons around the
/// amount, the same grey as the sheet's header circles.
///
/// The middle is any widget: a count ("1 serving") or, for a custom amount,
/// the typed field. The buttons carry their own 44pt targets.
class ScanAmountStepper extends StatelessWidget {
  const ScanAmountStepper({
    super.key,
    required this.child,
    required this.onDecrease,
    required this.onIncrease,
  });

  final Widget child;

  /// Null disables that side (at the floor or the cap).
  final VoidCallback? onDecrease;
  final VoidCallback? onIncrease;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _RoundButton(
          icon: LucideIcons.minus300,
          label: 'logging.scan.decrease'.tr(),
          onTap: onDecrease,
        ),
        ConstrainedBox(
          constraints: const BoxConstraints(minWidth: 88),
          child: Center(child: child),
        ),
        _RoundButton(
          icon: LucideIcons.plus300,
          label: 'logging.scan.increase'.tr(),
          onTap: onIncrease,
        ),
      ],
    );
  }
}

class _RoundButton extends StatelessWidget {
  const _RoundButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: CupertinoButton(
        onPressed:
            onTap == null
                ? null
                : () {
                  HapticFeedback.selectionClick();
                  onTap!();
                },
        padding: EdgeInsets.zero,
        minimumSize: const Size.square(KalloIcons.hit),
        child: Container(
          width: 32,
          height: 32,
          decoration: const BoxDecoration(
            color: kTrack,
            shape: BoxShape.circle,
          ),
          child: Icon(
            icon,
            size: 16,
            color: onTap == null ? KalloColors.textMuted : kInk,
          ),
        ),
      ),
    );
  }
}
