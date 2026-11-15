import 'package:flutter/cupertino.dart';
import '../../../shell/window/window_layout.dart';
import '../../../shell/window/window_regions.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import 'kallo_alert_surface.dart';
import 'kallo_confirm_actions.dart';

/// The confirmation content scrolls inside its window-bounded alert frame.
class KalloConfirmDialog extends StatelessWidget {
  const KalloConfirmDialog({
    super.key,
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
    final frame = WindowRegions(
      WindowLayout.of(context),
    ).dialogFrame(kKalloAlertMaxWidth);
    return Padding(
      padding: frame.padding,
      child: LayoutBuilder(
        builder:
            (context, screen) => Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp6),
                child: SizedBox(
                  width: kalloAlertWidth(
                    screen.maxWidth,
                  ).clamp(0, frame.maxWidth),
                  child: KalloAlertSurface(
                    // Outside any Material, `WidgetsApp`'s fallback DefaultTextStyle
                    // is the red/double-yellow-underline error style, and every
                    // `Text(style: …)` here MERGES onto it — which is where the
                    // yellow underline under the title came from. Naming the default
                    // (with an explicit `decoration: none`) is the fix.
                    child: DefaultTextStyle(
                      style: dashBody().copyWith(
                        decoration: TextDecoration.none,
                      ),
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
                                onConfirm:
                                    () => Navigator.of(context).pop(true),
                                onCancel:
                                    () => Navigator.of(context).pop(false),
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
      ),
    );
  }
}
