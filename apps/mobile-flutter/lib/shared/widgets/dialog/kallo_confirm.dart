import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import 'kallo_confirm_actions.dart';

/// The app's ONE confirmation dialog.
///
/// Before this there were three chromes: a bare Material `AlertDialog` in the
/// logging feed and both Circle group actions, a `CupertinoActionSheet` in
/// Settings, and a full-screen type-to-confirm route for account deletion. The
/// first of those rendered stock M3 — a left-aligned `headlineSmall`, a 28pt
/// radius, an `OverflowBar` footer — which matched nothing else in the app.
///
/// **2026-09-03 (user decision): both options are explicit verbs, and the
/// destructive one is a RED-FILLED button.** The dialog used to answer every
/// question with "Đồng ý" / "Huỷ", on the theory that a verb beside "huỷ" —
/// which in Vietnamese means both *cancel* and *destroy* — reads as the same
/// choice twice. The fix for that ambiguity was the wrong one: it removed the
/// information instead of the collision, so the user had to read the title to
/// find out what "Đồng ý" agreed to. Both labels now name their own outcome
/// ("Xoá" / "Giữ lại", "Đăng xuất" / "Ở lại"), and the two are unmistakable by
/// colour as well as by word — the affirmative is a filled pill, red when it
/// destroys something, and the safe option is a quiet ghost button under it.
/// That is why [confirmLabel] and [cancelLabel] are REQUIRED: there is no
/// generic pair left to fall back to, and every call site must state its verbs.
///
/// The chrome is the platform's: an iOS scale-in over a blurred barrier
/// ([showCupertinoDialog] + [CupertinoPopupSurface], 270pt like a system
/// alert). The CONTENT is the app's — Be Vietnam Pro, the app's press language,
/// the app's red — because the two buttons are stacked full-width rather than
/// split across a hairline, which is what makes "which one is safe" answerable
/// at a glance in two languages with very different word lengths.
///
/// Returns false for every way out that is not the affirmative — cancel, the
/// barrier, and the system back gesture alike.
Future<bool> showKalloConfirm(
  BuildContext context, {
  required String title,
  required String confirmLabel,
  required String cancelLabel,
  String? description,
  bool destructive = false,
}) async {
  // The cue that a decision is being asked for. The two Cupertino sheets this
  // replaced already fired it; now every confirm does.
  HapticFeedback.lightImpact();
  final confirmed = await showCupertinoDialog<bool>(
    context: context,
    barrierDismissible: true,
    // These confirms open from inside bottom sheets, which now live on the
    // root navigator too (see `showNhamSheet`). Keeping the dialog explicitly
    // rooted means it is never owned by a surface that can be dismissed out
    // from under it.
    useRootNavigator: true,
    builder:
        (dialogContext) => _KalloConfirmDialog(
          title: title,
          description: description,
          confirmLabel: confirmLabel,
          cancelLabel: cancelLabel,
          destructive: destructive,
        ),
  );
  return confirmed ?? false;
}

/// A system alert is 270pt wide on every iPhone. Matching it is most of what
/// makes a custom card read as the platform's own.
const double _kAlertWidth = 270;

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
    // Without the theme override the surface renders SF Pro and system blue —
    // the only two things on screen that would not be the app's.
    return CupertinoTheme(
      data: CupertinoThemeData(
        brightness: Brightness.light,
        primaryColor: kInk,
        textTheme: CupertinoTextThemeData(
          textStyle: dashBody(),
          actionTextStyle: dashBody(),
        ),
      ),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp6),
          child: SizedBox(
            width: _kAlertWidth,
            child: CupertinoPopupSurface(
              // Two long verbs at the 1.3x Dynamic Type cap outgrow a short
              // phone; the card scrolls rather than overflowing.
              child: SingleChildScrollView(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: KalloSpacing.sp4,
                    vertical: KalloSpacing.sp5,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        title,
                        textAlign: TextAlign.center,
                        style: kSectionHeader(),
                      ),
                      if (message != null) ...[
                        const SizedBox(height: KalloSpacing.sp2),
                        Text(
                          message,
                          textAlign: TextAlign.center,
                          style: dashMeta(),
                        ),
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
              ),
            ),
          ),
        ),
      ),
    );
  }
}
