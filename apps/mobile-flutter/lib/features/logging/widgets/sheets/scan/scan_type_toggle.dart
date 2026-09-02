import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_theme.dart';

/// Which side of the package the user is pointing the phone at.
enum ScanType { barcode, label }

/// Barcode / nutrition-label switch at the top of the scan sheet — the app's
/// segmented-control skin (native pass, 2026-08-31): a 36pt track-filled
/// capsule with a white selected pill, hung inside a 44pt tap target so the
/// visual stays compact without shrinking the target.
///
/// It fills the sheet's content width (the body's own 16pt inset) rather than
/// the 240pt it was pinned to: at 240 each segment had ~105pt of text room,
/// which ellipsised the second label to "Nutrition l…" in English and could
/// not hold the Vietnamese one at ANY size the ramp allows. Width plus the
/// shorter label ("Nutrition" / "Dinh dưỡng") is what makes both fit at the
/// 1.3x text scale — see `scan_type_toggle_test.dart`, which measures it.
///
/// Shown only while a branch is still at its entry step — once a product or a
/// scanned label is on screen, switching would throw that work away.
class ScanTypeToggle extends StatelessWidget {
  const ScanTypeToggle({super.key, required this.value, required this.onChange});

  final ScanType value;
  final ValueChanged<ScanType> onChange;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp4),
      child: SizedBox(
        height: 44,
        child: Center(
          child: Container(
            height: 36,
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: kTrack,
              borderRadius: BorderRadius.circular(KalloRadii.pill),
            ),
            child: Row(
              children: [
                // Equal flex, always: a selected pill wider than the segment
                // beside it would make the control look mis-measured.
                for (final type in ScanType.values)
                  Expanded(
                    child: _Segment(
                      label: type == ScanType.barcode
                          ? 'logging.scan.barcodeTab'.tr()
                          : 'logging.scan.labelTab'.tr(),
                      selected: type == value,
                      onTap: () {
                        if (type == value) return;
                        HapticFeedback.selectionClick();
                        onChange(type);
                      },
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Segment extends StatelessWidget {
  const _Segment({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          curve: Curves.easeInOut,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? kCardSurface : Colors.transparent,
            borderRadius: BorderRadius.circular(KalloRadii.pill),
          ),
          child: Padding(
            // 4, not 6: the two extra points bought nothing and the label
            // needs every one of them at the 1.3x scale.
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Text(
              label,
              maxLines: 1,
              // A safety net only — the test proves it never triggers.
              overflow: TextOverflow.ellipsis,
              style: dashBody(
                color: selected ? kInk : kInkMuted,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
