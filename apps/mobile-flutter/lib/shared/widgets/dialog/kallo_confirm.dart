import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import 'kallo_confirm_actions.dart';

/// The app's ONE confirmation dialog.
///
/// Before this there were three chromes: a bare Material [AlertDialog] in the
/// logging feed and both Circle group actions, a `CupertinoActionSheet` in
/// Settings, and a full-screen type-to-confirm route for account deletion. The
/// first of those rendered stock M3 — a left-aligned `headlineSmall`, a 28pt
/// radius, an `OverflowBar` footer — which matched nothing else in the app.
///
/// This is the sheet header's composition instead ([KalloSheetHeader]): a
/// centered title in Value 17/600, a centered muted line under it, one named
/// rhythm. The buttons stack; see [KalloConfirmActions] for why.
///
/// Returns false for every way out that is not the affirmative — cancel, the
/// barrier, and the system back gesture alike.
Future<bool> showKalloConfirm(
  BuildContext context, {
  required String title,
  String? description,
  String? confirmLabel,
  String? cancelLabel,
  bool destructive = false,
}) async {
  // The cue that a decision is being asked for. The two Cupertino sheets this
  // replaced already fired it; now every confirm does.
  HapticFeedback.lightImpact();
  final confirmed = await showDialog<bool>(
    context: context,
    barrierDismissible: true,
    // The group confirms open from inside a bottom sheet. Without this the
    // sheet's own navigator owns the dialog, and popping the sheet takes the
    // dialog with it.
    useRootNavigator: true,
    builder:
        (dialogContext) => _KalloConfirmDialog(
          title: title,
          description: description,
          confirmLabel: confirmLabel ?? 'common.agree'.tr(),
          cancelLabel: cancelLabel ?? 'common.cancel'.tr(),
          destructive: destructive,
        ),
  );
  return confirmed ?? false;
}

class _KalloConfirmDialog extends StatelessWidget {
  const _KalloConfirmDialog({
    required this.title,
    required this.description,
    required this.confirmLabel,
    required this.cancelLabel,
    required this.destructive,
  });

  final String title;
  final String? description;
  final String confirmLabel;
  final String cancelLabel;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final message = description;
    // Deliberately Dialog, not AlertDialog: AlertDialog hard-codes
    // `headlineSmall`, a left-aligned title and an OverflowBar footer — the
    // three things being replaced. Surface, radius and inset come from the
    // theme's dialogTheme so a dialog built anywhere else still lands here.
    return Dialog(
      child: Padding(
        // Horizontal is half the vertical: the card is already inset 24 from
        // each screen edge by the dialog theme, so a matching 20 in here spent
        // 44 a side before any content started. The stacked buttons want the
        // width more than the edge wants the air.
        padding: const EdgeInsets.symmetric(
          horizontal: KalloSpacing.sp2_5,
          vertical: KalloSpacing.sp5,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              title,
              textAlign: TextAlign.center,
              style: dashValue().copyWith(fontWeight: FontWeight.w600),
            ),
            if (message != null) ...[
              const SizedBox(height: KalloSpacing.sp2),
              Text(message, textAlign: TextAlign.center, style: dashMeta()),
            ],
            const SizedBox(height: KalloSpacing.sp5),
            KalloConfirmActions(
              confirmLabel: confirmLabel,
              cancelLabel: cancelLabel,
              destructive: destructive,
              onConfirm: () => Navigator.of(context).pop(true),
              onCancel: () => Navigator.of(context).pop(false),
            ),
          ],
        ),
      ),
    );
  }
}
