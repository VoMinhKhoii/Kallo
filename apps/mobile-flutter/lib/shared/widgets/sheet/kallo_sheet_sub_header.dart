import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../chrome/inline_nav_bar.dart';
import 'kallo_sheet.dart';

/// The header for a sheet's SECOND level — the page a sheet pushes to without
/// stacking a second modal on the first.
///
/// Mirrors [KalloSheetHeader]'s chrome (grabber, the same inherited content
/// inset) over the app's [InlineNavBar]: "‹ " + the title of the page it came
/// from, so the way out names where it goes, and this page's title centred.
/// The bar is shared with the settings sub-pages, which push the same way.
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
          child: InlineNavBar(
            title: title,
            parentTitle: parentTitle,
            onBack: onBack,
          ),
        ),
      ],
    );
  }
}
