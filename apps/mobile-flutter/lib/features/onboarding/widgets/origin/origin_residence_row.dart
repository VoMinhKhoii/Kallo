import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/widgets/typography/meta_action.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';

/// The quiet consequence of picking an origin: where the phone thinks you
/// actually LIVE, with one word to correct it.
///
/// Deliberately not a second picker on the page. Residence changes the
/// ingredients the AI reaches for, not the cuisine, so it is a footnote to the
/// origin question rather than a peer of it — one 48pt line, muted, with the
/// full country list only a tap away behind "Change".
class OriginResidenceRow extends StatelessWidget {
  const OriginResidenceRow({
    super.key,
    required this.country,
    required this.fromDevice,
    required this.onChange,
  });

  /// The residence country's stored English name.
  final String country;

  /// Whether this is still the phone's guess. Once the user has corrected it
  /// through the sheet the line must stop crediting the phone for it.
  final bool fromDevice;

  final VoidCallback onChange;

  static const double height = 48;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp4),
      decoration: BoxDecoration(
        color: kCardSurface,
        borderRadius: BorderRadius.circular(KalloRadii.containerLg),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              tr(
                fromDevice
                    ? 'onboarding.origin.livingIn'
                    : 'onboarding.origin.livingInChanged',
                namedArgs: {'country': country},
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: dashMeta(),
            ),
          ),
          const SizedBox(width: KalloSpacing.sp2),
          MetaAction(
            label: tr('onboarding.origin.change'),
            onTap: onChange,
            color: kInk,
            padding: const EdgeInsets.only(left: KalloSpacing.sp3),
          ),
        ],
      ),
    );
  }
}
