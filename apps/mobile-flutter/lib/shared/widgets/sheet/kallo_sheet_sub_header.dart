import 'package:flutter/material.dart';

import 'kallo_sheet_header.dart';

/// The header for a sheet's SECOND level — the page a sheet pushes to without
/// stacking a second modal on the first.
///
/// The same header as the first level, with the grey circle turned into a back
/// chevron: iOS 26 sheets name the way out with the control, not with the
/// parent's title beside it, and the two levels now share one geometry.
class KalloSheetSubHeader extends StatelessWidget {
  const KalloSheetSubHeader({
    super.key,
    required this.title,
    required this.onBack,
    this.trailing,
  });

  /// The page's own title, centred.
  final String title;

  final VoidCallback onBack;

  /// An optional right-hand action, as on the first level.
  final Widget? trailing;

  @override
  Widget build(BuildContext context) =>
      KalloSheetHeader(title: title, onBack: onBack, trailing: trailing);
}
