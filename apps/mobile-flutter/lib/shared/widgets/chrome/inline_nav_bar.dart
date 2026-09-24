import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show HapticFeedback;
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';

/// iOS's inline navigation bar for a page one level down: "‹ " + the page it
/// came from on the leading edge, this page's own title centred at
/// [kSectionHeader].
///
/// The large left-aligned 28pt [PageHeader] is the ROOT of a stack; a pushed
/// page wearing the same headline read as another top-level screen, so nothing
/// told the user they were one level deep. This is the bar that does.
///
/// The title is centred on the BAR, not on the room the back group leaves — a
/// title that slides sideways as the parent's name grows reads as a different
/// header on every page. So the back group gives way instead: past ~38% of the
/// width it reads "Back" ([_label]), iOS's own rule.
///
/// Shared by the settings sub-pages and [KalloSheetSubHeader], which adds the
/// grabber above it. No fill and no border: the hairline under it belongs to
/// `ScrollSeparator`, which only draws it once content has scrolled.
class InlineNavBar extends StatelessWidget {
  const InlineNavBar({
    super.key,
    required this.title,
    required this.parentTitle,
    this.onBack,
  });

  /// This page's title, centred.
  final String title;

  /// The title of the page this one was pushed from.
  final String parentTitle;

  /// Defaults to `maybePop` on the nearest navigator — inside settings that is
  /// the nested one, so back goes up one level instead of closing the screen.
  final VoidCallback? onBack;

  static const double height = 44;

  /// Share of the bar the back group may take before it gives way.
  static const double _backShare = 0.38;

  /// The parent's title when it fits, "Back" when it does not — and the
  /// width the back group then takes, so the centred title can keep clear of
  /// exactly that much on both sides.
  ///
  /// Our parent titles are not all short nouns — the log-mode sheet's is the
  /// question "How do you want to log?" — and ellipsising one to "How do you
  /// wa…" would name nothing; the generic word at least says what it does.
  ({String text, double width}) _back(BuildContext context, double available) {
    double measure(String text) =>
        (TextPainter(
          text: TextSpan(text: text, style: dashBody()),
          textDirection: Directionality.of(context),
          textScaler: MediaQuery.textScalerOf(context),
          maxLines: 1,
        )..layout()).width;
    final room = available * _backShare - KalloIcons.size;
    final parent = measure(parentTitle);
    if (parent <= room) {
      return (text: parentTitle, width: KalloIcons.size + parent);
    }
    final fallback = 'common.back'.tr();
    return (text: fallback, width: KalloIcons.size + measure(fallback));
  }

  @override
  Widget build(BuildContext context) {
    final back = onBack ?? () => Navigator.of(context).maybePop();
    return LayoutBuilder(
      builder: (context, constraints) {
        final label = _back(context, constraints.maxWidth);
        return Stack(
          alignment: Alignment.center,
          children: [
            SizedBox(
              height: height,
              child: Center(
                child: Padding(
                  // Keep the centred title clear of the back group on both
                  // sides, so it truncates before it runs under it.
                  padding: EdgeInsets.symmetric(
                    horizontal: label.width + KalloSpacing.sp2,
                  ),
                  child: Text(
                    title,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: kSectionHeader(),
                  ),
                ),
              ),
            ),
            Align(
              alignment: Alignment.centerLeft,
              child: Semantics(
                button: true,
                label: parentTitle,
                excludeSemantics: true,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () {
                    HapticFeedback.selectionClick();
                    back();
                  },
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      maxWidth: constraints.maxWidth * _backShare,
                      minHeight: height,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          LucideIcons.chevronLeft300,
                          size: KalloIcons.size,
                          color: KalloColors.textMuted,
                        ),
                        Flexible(
                          child: Text(
                            label.text,
                            maxLines: 1,
                            style: dashBody(color: KalloColors.textMuted),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
