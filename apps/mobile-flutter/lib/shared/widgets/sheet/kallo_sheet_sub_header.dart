import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import 'kallo_sheet.dart';

/// The header for a sheet's SECOND level — the page a sheet pushes to without
/// stacking a second modal on the first.
///
/// Mirrors [KalloSheetHeader]'s chrome (grabber, 17/600 title, the same
/// inherited content inset) and swaps the close X for a back affordance
/// reading "‹ " + the title of the page it came from, so the way out names
/// where it goes instead of just pointing. The current page's own title stays
/// centred on the sheet, not on the space the back group leaves — a title that
/// slides sideways as the parent's name gets longer reads as a different
/// header on every page.
class KalloSheetSubHeader extends StatelessWidget {
  const KalloSheetSubHeader({
    super.key,
    required this.title,
    required this.parentTitle,
    required this.onBack,
  });

  /// The page's own title, centred.
  final String title;

  /// The title of the sheet this page was pushed from.
  final String parentTitle;

  final VoidCallback onBack;

  /// Matches [KalloSheetHeader]'s close target.
  static const double _target = 44;

  /// The parent's title when it fits, "Back" when it does not.
  ///
  /// This is iOS's own rule, and it is the honest one: our parent titles are
  /// not all short nouns like the reference's "Select model" — the mode
  /// sheet's is the question "How do you want to log?", which at this size
  /// wants ~175pt against the ~120pt a back group can take without running
  /// under the centred title. Ellipsising it to "How do you wa…" would name
  /// nothing; the generic word at least says what the control does.
  String _label(BuildContext context, double available) {
    final style = dashBody(color: KalloColors.textMuted);
    final painter = TextPainter(
      text: TextSpan(text: parentTitle, style: style),
      textDirection: Directionality.of(context),
      textScaler: MediaQuery.textScalerOf(context),
      maxLines: 1,
    )..layout();
    // The chevron's width, and the room the centred title needs beside it.
    final room = available * 0.38 - KalloIcons.size;
    return painter.width <= room ? parentTitle : 'common.back'.tr();
  }

  @override
  Widget build(BuildContext context) {
    final inset = math.max(
      0.0,
      kSheetContentInset - SheetContentInset.of(context),
    );

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: KalloSpacing.sp2),
        Container(
          width: 36,
          height: 5,
          decoration: BoxDecoration(
            color: KalloColors.border,
            borderRadius: BorderRadius.circular(2.5),
          ),
        ),
        const SizedBox(height: KalloSpacing.sp2),
        Padding(
          padding: EdgeInsets.fromLTRB(inset, 0, inset, KalloSpacing.sp1),
          child: LayoutBuilder(
            builder: (context, constraints) => Stack(
              alignment: Alignment.center,
              children: [
                // Centred on the sheet, so it does not drift with the length
                // of the parent's name.
                SizedBox(
                  height: _target,
                  child: Center(
                    child: Text(
                      title,
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: kSectionHeader(),
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
                      onTap: onBack,
                      child: ConstrainedBox(
                        // Never let a long parent name run under the centred
                        // title: it gives way first.
                        constraints: BoxConstraints(
                          maxWidth: constraints.maxWidth * 0.38,
                          minHeight: _target,
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
                                _label(context, constraints.maxWidth),
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
            ),
          ),
        ),
      ],
    );
  }
}
