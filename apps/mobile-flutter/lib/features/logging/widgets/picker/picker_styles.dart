import 'package:flutter/painting.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';

/// Text on the picker band — the under-logged notice's pairing (white copy on
/// the muted band), shared by the `/` picker and cheat mode's "log it again".
///
/// Every line is FULL white: hierarchy comes from size and letter-spacing,
/// never opacity, because translucent white on the band drops the smaller
/// lines below 4.5:1.
abstract final class PickerStyles {
  /// An option's name.
  static final TextStyle body = dashBody(color: KalloColors.bandForeground);

  /// An option's subtitle and kcal, and the band's empty / error copy.
  static final TextStyle meta = dashMeta(color: KalloColors.bandForeground);

  /// The same, with tabular figures so stacked numbers line up.
  static final TextStyle metaTabular = dashMeta(
    color: KalloColors.bandForeground,
    tabular: true,
  );

  /// Group labels and the band's title. Upper-case it at the call site.
  static final TextStyle eyebrow = dashEyebrow(
    color: KalloColors.bandForeground,
  );
}
