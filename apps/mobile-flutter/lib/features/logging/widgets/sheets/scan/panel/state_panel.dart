import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../../shared/data/surface_cast.dart';
import '../../../../../../shared/widgets/feedback/kallo_surface_state.dart';
import '../../../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../../../shared/widgets/sheet/sheet_capsule_button.dart';
import '../../../../../../shared/widgets/surface/kallo_button.dart';
import '../../../../../../theme/kallo_theme.dart';
import 'panel.dart';

/// One way forward from a miss: what it says and the glyph that says it.
class ScanStateAction {
  const ScanStateAction({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;
}

/// A scan that found nothing — a code not in the database, a photo with no
/// readable table — as the app's own surface state: the Logging otter, a line
/// of what happened, and the ways forward as FULL-WIDTH buttons at the bottom
/// (the first filled, the rest quiet). "Enter manually" rides the header,
/// where Edit sits on a result, because it leaves scanning altogether.
///
/// Nothing here retries the photo that just failed (owner review): the ways
/// forward are a different photo, the other side of the package, or typing.
class ScanStatePanel extends StatelessWidget {
  const ScanStatePanel({
    super.key,
    required this.kind,
    required this.title,
    required this.message,
    required this.actions,
    required this.onClose,
    required this.onEnterManually,
  });

  /// `empty` for a miss (the otter peeking from its box), `error` for a photo
  /// that could not be read (the otter in its string).
  final SurfaceKind kind;
  final String title;
  final String message;
  final List<ScanStateAction> actions;

  /// Back to the live camera.
  final VoidCallback onClose;

  /// Gated like the editor.
  final VoidCallback onEnterManually;

  @override
  Widget build(BuildContext context) {
    return ScanPanel(
      height: ScanPanelHeight.fit,
      onDismiss: onClose,
      header: KalloSheetHeader(
        onClose: onClose,
        trailing: SheetCapsuleButton(
          label: 'logging.scan.enterManually'.tr(),
          icon: LucideIcons.pencilLine300,
          onTap: onEnterManually,
        ),
      ),
      body: Padding(
        // The state sizes to its words here (no 288pt box to centre in); its
        // own 24pt sides are the canvas's measure.
        padding: const EdgeInsets.only(top: 8, bottom: 50),
        child: KalloSurfaceState(
          area: SurfaceArea.logging,
          kind: kind,
          title: title,
          subtitle: message,
          minHeight: 0,
        ),
      ),
      dock: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final (i, action) in actions.indexed) ...[
              if (i > 0) const SizedBox(height: KalloSpacing.sp1),
              KalloButton(
                title: action.label,
                icon: action.icon,
                variant:
                    i == 0
                        ? KalloButtonVariant.primary
                        : KalloButtonVariant.ghost,
                onPressed: action.onTap,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
