import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import 'kallo_alert_surface.dart';
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
/// chrome AND the content are the platform's now — a 270pt card scaled in over
/// the barrier, a centred title and message, then stacked full-width text
/// actions divided by 0.5pt hairlines: the destructive verb red and semibold,
/// the safe one quiet ink. Only the type is the app's (Be Vietnam Pro,
/// [kSectionHeader]/[dashBody]). The stack survives the rewrite:
/// [CupertinoAlertDialog] would put two short verbs side by side, which is the
/// arrangement the labels change was about.
///
/// **2026-09-07: the card is SOLID white, and the barrier is the app's.** It
/// was a `CupertinoPopupSurface`, whose fill is ~80% opaque over a backdrop
/// blur. That put the one frosted, see-through surface in an app whose design
/// system opens by naming solid surfaces and no stacked translucency
/// (`calm_tokens.dart`) — and it made the press wash on an action row read as
/// a glitch, an opaque patch appearing on a translucent card. The 14pt corner
/// and the 270pt width are kept; only the material changed.
///
/// The scrim moved with it. [showCupertinoDialog] ignores
/// `dialogTheme.barrierColor` and supplies its own ~20% black, so this dialog
/// dimmed the page less than every other modal in the app; it now passes the
/// theme's value explicitly.
///
/// **2026-10-28 (user decision): the iOS 26 in-app alert, minus Liquid
/// Glass.** Measured off a real `UIAlertController` on the iOS 26.3 simulator:
/// a 318pt card with a 28pt corner, the title and a muted message
/// left-aligned 30pt in, then pills (see [KalloConfirmActions]). It comes in
/// as the system's does — a fade from 1.08x — and leaves with no shrink. The
/// solid card above stays: only the anatomy is the system's.
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
  final confirmed = await showGeneralDialog<bool>(
    context: context,
    barrierDismissible: true,
    barrierLabel: CupertinoLocalizations.of(context).modalBarrierDismissLabel,
    transitionDuration: kKalloAlertFade,
    transitionBuilder: kalloAlertTransition,
    pageBuilder:
        (dialogContext, _, __) => _KalloConfirmDialog(
          title: title,
          description: description,
          confirmLabel: confirmLabel,
          cancelLabel: cancelLabel,
          destructive: destructive,
        ),
    // Explicit, because a raw dialog route does NOT read
    // `dialogTheme.barrierColor`. Same black/50 the nav drawer, the sheets and
    // the web dialog use.
    barrierColor: kKalloAlertBarrier,
    // These confirms open from inside bottom sheets, which now live on the
    // root navigator too (see `showNhamSheet`). Keeping the dialog explicitly
    // rooted means it is never owned by a surface that can be dismissed out
    // from under it.
    useRootNavigator: true,
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
    // The route hands its page the whole screen, so the card's width is
    // read from that, not from MediaQuery — which a caller (or a test) may
    // have narrowed to text settings only.
    return LayoutBuilder(
      builder:
          (context, screen) => Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp6),
              child: SizedBox(
                width: kalloAlertWidth(screen.maxWidth),
                child: KalloAlertSurface(
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
                            // The iOS 26 alert's text inset: 30pt at the
                            // sides, the title's cap ~22pt below the top.
                            padding: const EdgeInsets.fromLTRB(
                              kKalloAlertTextInset,
                              KalloSpacing.sp5,
                              kKalloAlertTextInset,
                              KalloSpacing.sp6,
                            ),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(title, style: kSheetTitle()),
                                if (message != null) ...[
                                  const SizedBox(height: KalloSpacing.sp2),
                                  // Muted under the title, as the system
                                  // sets it; Body, not Meta, because 14
                                  // read as fine print.
                                  Text(
                                    message,
                                    style: dashBody(color: kInkMuted),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(
                              kKalloAlertActionInset,
                              0,
                              kKalloAlertActionInset,
                              kKalloAlertActionInset,
                            ),
                            child: KalloConfirmActions(
                              confirmLabel: confirmLabel,
                              cancelLabel: cancelLabel,
                              destructive: destructive,
                              onConfirm: () => Navigator.of(context).pop(true),
                              onCancel: () => Navigator.of(context).pop(false),
                            ),
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
