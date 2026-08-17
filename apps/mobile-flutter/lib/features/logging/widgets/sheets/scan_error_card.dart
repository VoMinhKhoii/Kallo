import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/widgets/nham_text.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import 'scan_sheet_controls.dart';

/// One recovery action offered under a scan error.
class ScanErrorAction {
  const ScanErrorAction({
    required this.label,
    required this.onTap,
    this.icon,
  });

  final String label;
  final VoidCallback onTap;

  /// Null renders the action as the filled primary button; an icon renders it
  /// as a bordered secondary.
  final IconData? icon;
}

/// Warm error card with recovery actions — never a bare red toast.
///
/// Shared by both branches of the scan sheet: a barcode we couldn't find
/// offers the nutrition label, and a photo with no printed table offers the
/// barcode. [detail] carries the scanned code, when there is one.
class ScanErrorCard extends StatelessWidget {
  const ScanErrorCard({
    super.key,
    required this.icon,
    required this.message,
    required this.primary,
    this.detail,
    this.secondary = const [],
    this.quiet,
  });

  final IconData icon;
  final String message;
  final String? detail;
  final ScanErrorAction primary;
  final List<ScanErrorAction> secondary;
  final ScanErrorAction? quiet;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    final quietAction = quiet;
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        NhamSpacing.sp4,
        NhamSpacing.sp2,
        NhamSpacing.sp4,
        bottomInset + NhamSpacing.sp3,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(NhamSpacing.sp3),
            decoration: BoxDecoration(
              color: NhamColors.danger.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(NhamRadii.containerLg),
              border: Border.all(
                color: NhamColors.danger.withValues(alpha: 0.35),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(icon, size: 18, color: NhamColors.danger),
                    const SizedBox(width: NhamSpacing.sp2),
                    Expanded(
                      child: NhamText(
                        message,
                        variant: NhamTextVariant.body,
                        style: const TextStyle(color: NhamColors.text),
                      ),
                    ),
                  ],
                ),
                if (detail != null && detail!.isNotEmpty) ...[
                  const SizedBox(height: NhamSpacing.sp1),
                  NhamText(
                    detail!,
                    variant: NhamTextVariant.numCaption,
                    style: const TextStyle(color: NhamColors.textMuted),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: NhamSpacing.sp3),
          ScanPrimaryButton(label: primary.label, onTap: primary.onTap),
          for (final action in secondary) ...[
            const SizedBox(height: NhamSpacing.sp2),
            ScanOutlineButton(
              icon: action.icon ?? LucideIcons.arrowRight300,
              label: action.label,
              onTap: action.onTap,
            ),
          ],
          if (quietAction != null) ...[
            const SizedBox(height: NhamSpacing.sp2),
            Center(
              child: ScanQuietButton(
                icon: quietAction.icon ?? LucideIcons.keyboard300,
                label: quietAction.label,
                onTap: quietAction.onTap,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
