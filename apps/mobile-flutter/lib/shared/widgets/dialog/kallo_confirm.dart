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
/// destructive one is red.** The dialog used to answer every question with
/// "Đồng ý" / "Huỷ", on the theory that a verb beside "huỷ" — which in
/// Vietnamese means both *cancel* and *destroy* — reads as the same choice
/// twice. The fix for that ambiguity was the wrong one: it removed the
/// information instead of the collision, so the user had to read the title to
/// find out what "Đồng ý" agreed to. Both labels now name their own outcome
/// ("Xoá" / "Giữ lại", "Đăng xuất" / "Ở lại"). That is why [confirmLabel] and
/// [cancelLabel] are REQUIRED: there is no generic pair left to fall back to,
/// and every call site must state its verbs.
///
/// **2026-09-03, second pass (user reference: Instagram's iOS "Delete post?"
/// alert): the filled pills are retired for the native alert anatomy.** The
/// chrome AND the content are the platform's now — a 270pt
/// [CupertinoPopupSurface] scaled in over a blurred barrier, a centred title
/// and message, then stacked full-width text actions divided by 0.5pt
/// hairlines: the destructive verb red and semibold, the safe one quiet ink.
/// Only the type is the app's (Be Vietnam Pro, [kSectionHeader]/[dashBody]).
/// The stack survives the rewrite: [CupertinoAlertDialog] would put two short
/// verbs side by side, which is the arrangement the labels change was about.
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
              // Outside any Material, `WidgetsApp`'s fallback DefaultTextStyle
              // is the red/double-yellow-underline error style, and every
              // `Text(style: …)` here MERGES onto it — which is where the
              // yellow underline under the title came from. Naming the default
              // (with an explicit `decoration: none`) is the fix.
              child: DefaultTextStyle(
                style: dashBody().copyWith(decoration: TextDecoration.none),
                // Two long verbs at the 1.3x Dynamic Type cap outgrow a short
                // phone; the card scrolls rather than overflowing.
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Padding(
                        // The system alert's own content inset: 20 top/bottom,
                        // 16 sides. The actions below run full-bleed so their
                        // hairlines reach both edges.
                        padding: const EdgeInsets.fromLTRB(
                          KalloSpacing.sp4,
                          KalloSpacing.sp5,
                          KalloSpacing.sp4,
                          KalloSpacing.sp5,
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
                              const SizedBox(height: KalloSpacing.sp1),
                              Text(
                                message,
                                textAlign: TextAlign.center,
                                // Ink, not muted: an alert's message is the
                                // consequence being consented to, and iOS
                                // paints it near-black under the title.
                                style: dashMeta(color: kInk),
                              ),
                            ],
                          ],
                        ),
                      ),
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
