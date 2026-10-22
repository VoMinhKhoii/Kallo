import 'package:flutter/widgets.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';

/// A strip's colours, and whether it fills its row or hugs its words.
enum SegmentedStripTone {
  /// The warm track under a white thumb, filling the row.
  standard(
    rim: Color(0x0F141413), // ink @ 6%
    thumbShadow: true,
    labelInset: 0,
  ),

  /// Over a live picture (the scan camera's mode switch): the [kGlass] of the
  /// controls around it under a lighter thumb, white words — sized to its
  /// labels and centred, a chip rather than a full-width bar.
  overPhoto(
    rim: Color(0x33FFFFFF), // white @ 20%, the glass edge catching light
    thumbShadow: false,
    labelInset: KalloSpacing.sp3 + 2,
  );

  const SegmentedStripTone({
    required this.rim,
    required this.thumbShadow,
    required this.labelInset,
  });

  // [track], [thumb] and [label] are getters, not constructor fields: an enum
  // value is a constant, and the standard tone's colours come from the
  // runtime palette.
  Color get track => switch (this) {
    standard => KalloColors.track,
    overPhoto => kGlass,
  };

  Color get thumb => switch (this) {
    standard => kCardSurface,
    overPhoto => const Color(0x38FFFFFF),
  };

  /// [rim] is the thumb's hairline edge — what makes it read as a raised
  /// piece of glass rather than a flat fill (iOS 26's segmented control).
  final Color rim;

  /// Every label's colour. The selection is the thumb plus a heavier label,
  /// as on iOS — not a muted colour for the segments beside it.
  Color get label => switch (this) {
    standard => kInk,
    overPhoto => const Color(0xFFFFFFFF),
  };

  final bool thumbShadow;

  /// Room either side of a label, for a strip sized to its words.
  final double labelInset;

  bool get hugsLabels => labelInset > 0;
}
