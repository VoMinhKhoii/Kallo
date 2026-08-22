import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/widgets/form/sheet_action_buttons.dart';
import '../../../../shared/widgets/typography/kallo_text.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';

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
        KalloSpacing.sp4,
        KalloSpacing.sp2,
        KalloSpacing.sp4,
        bottomInset + KalloSpacing.sp3,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(KalloSpacing.sp3),
            decoration: BoxDecoration(
              color: KalloColors.danger.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(KalloRadii.containerLg),
              border: Border.all(
                color: KalloColors.danger.withValues(alpha: 0.35),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(icon, size: 18, color: KalloColors.danger),
                    const SizedBox(width: KalloSpacing.sp2),
                    Expanded(
                      child: KalloText(
                        message,
                        variant: KalloTextVariant.body,
                        style: const TextStyle(color: KalloColors.text),
                      ),
                    ),
                  ],
                ),
                if (detail != null && detail!.isNotEmpty) ...[
                  const SizedBox(height: KalloSpacing.sp1),
                  KalloText(
                    detail!,
                    variant: KalloTextVariant.numCaption,
                    style: const TextStyle(color: KalloColors.textMuted),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: KalloSpacing.sp3),
          SheetPrimaryButton(label: primary.label, onTap: primary.onTap),
          for (final action in secondary) ...[
            const SizedBox(height: KalloSpacing.sp2),
            SheetOutlineButton(
              icon: action.icon ?? LucideIcons.arrowRight300,
              label: action.label,
              onTap: action.onTap,
            ),
          ],
          if (quietAction != null) ...[
            const SizedBox(height: KalloSpacing.sp2),
            Center(
              child: QuietIconButton(
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
