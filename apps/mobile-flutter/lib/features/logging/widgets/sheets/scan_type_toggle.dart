import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import '../../../../theme/nham_typography.dart';

/// Which side of the package the user is pointing the phone at.
enum ScanType { barcode, label }

/// Barcode / nutrition-label switch at the top of the scan sheet.
///
/// Shown only while a branch is still at its entry step — once a product or a
/// scanned label is on screen, switching would throw that work away, so the
/// host hides it. Port of the web dialog's scan-type toggle.
class ScanTypeToggle extends StatelessWidget {
  const ScanTypeToggle({super.key, required this.value, required this.onChange});

  final ScanType value;
  final ValueChanged<ScanType> onChange;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        NhamSpacing.sp4,
        NhamSpacing.sp1,
        NhamSpacing.sp4,
        NhamSpacing.sp2,
      ),
      child: Container(
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          color: NhamColors.track,
          borderRadius: BorderRadius.circular(NhamRadii.lg),
        ),
        child: Row(
          children: [
            for (final type in ScanType.values)
              Expanded(
                child: _Segment(
                  icon: type == ScanType.barcode
                      ? LucideIcons.scanBarcode300
                      : LucideIcons.scanText300,
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
    );
  }
}

class _Segment extends StatelessWidget {
  const _Segment({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 120),
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: selected ? NhamColors.elev : Colors.transparent,
            borderRadius: BorderRadius.circular(NhamRadii.md),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 15,
                color: selected ? NhamColors.text : NhamColors.textMuted,
              ),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: NhamTextStyles.sansMedium(
                    fontSize: NhamFontSize.detail,
                  ).copyWith(
                    color: selected ? NhamColors.text : NhamColors.textMuted,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
