import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../shared/widgets/form/sheet_action_buttons.dart';
import '../../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';

/// One recovery action offered under a scan error.
class ScanErrorAction {
  const ScanErrorAction({required this.label, required this.onTap, this.icon});

  final String label;
  final VoidCallback onTap;

  /// Null renders the action as the beige primary; an icon renders it quiet.
  final IconData? icon;
}

/// The app's ONE error shape (native pass, 2026-08-31): a 44pt icon badge, a
/// 14/500 ink title, a 12 muted line of reason, then the actions — primary
/// beige, alternatives quiet.
///
/// Red lives on the badge and nowhere else. A card of red copy reads as an
/// alarm for something the user can usually just retry (mobile.md, "Status
/// colour"). [detail] carries the scanned code, when there is one.
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
    final bottomInset = MediaQuery.viewPaddingOf(context).bottom;
    final quietAction = quiet;
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        KalloSpacing.sp4,
        KalloSpacing.sp4,
        KalloSpacing.sp4,
        bottomInset + KalloSpacing.sp2,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                color: KalloColors.danger10,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: KalloIcons.size, color: KalloColors.danger),
            ),
          ),
          const SizedBox(height: KalloSpacing.sp3),
          Text(
            message,
            textAlign: TextAlign.center,
            style: dashBody(weight: FontWeight.w500),
          ),
          if (detail != null && detail!.isNotEmpty) ...[
            const SizedBox(height: KalloSpacing.sp1),
            Text(
              detail!,
              textAlign: TextAlign.center,
              style: dashMeta(tabular: true),
            ),
          ],
          const SizedBox(height: KalloSpacing.sp4),
          KalloButton(title: primary.label, onPressed: primary.onTap),
          for (final action in secondary) ...[
            const SizedBox(height: KalloSpacing.sp2),
            KalloButton(
              title: action.label,
              variant: KalloButtonVariant.secondary,
              onPressed: action.onTap,
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
