import 'package:flutter/widgets.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';

/// A strip's colours, and whether it fills its row or hugs its words.
enum SegmentedStripTone {
  /// The warm track under a white thumb, filling the row.
  standard(
    track: KalloColors.track,
    thumb: kCardSurface,
    thumbShadow: true,
    on: kInk,
    off: kInkMuted,
    labelInset: 0,
  ),

  /// Over a live picture (the scan camera's mode switch): the [kGlass] of the
  /// controls around it under a lighter thumb, white words — sized to its
  /// labels and centred, a chip rather than a full-width bar.
  overPhoto(
    track: kGlass,
    thumb: Color(0x38FFFFFF),
    thumbShadow: false,
    on: Color(0xFFFFFFFF),
    off: Color(0xB8FFFFFF),
    labelInset: KalloSpacing.sp3 + 2,
  );

  const SegmentedStripTone({
    required this.track,
    required this.thumb,
    required this.thumbShadow,
    required this.on,
    required this.off,
    required this.labelInset,
  });

  final Color track, thumb, on, off;
  final bool thumbShadow;

  /// Room either side of a label, for a strip sized to its words.
  final double labelInset;

  bool get hugsLabels => labelInset > 0;
}
