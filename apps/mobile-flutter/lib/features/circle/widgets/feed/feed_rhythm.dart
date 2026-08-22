import '../../../../theme/kallo_theme.dart';

/// Vertical rhythm, ink-to-ink.
///
/// [kFeedTight] binds a label to the thing it labels, [kFeedStandard] separates one
/// cluster from the next, and the post's padding (sp3) sits one step above
/// both. Threads runs the same shape at 8/16; this is that discipline at our
/// density.
///
/// [kFeedStandard] was sp3, matching the padding exactly — which left the meal name
/// and its own numbers as far apart as the meal was from the NEXT post, and
/// they read as two unrelated blocks. A gap inside a post has to be smaller
/// than the gap around it.
///
/// Gaps are measured between what the eye sees, not between widget boxes. The
/// action row is a 44pt tap target wrapped around a 16pt glyph, so it already
/// carries ~14pt of slack above and below its ink — that slack IS the gap on
/// either side of it. Adding a [SizedBox] there would render as ~26.
const double kFeedTight = KalloSpacing.sp1; // 4
const double kFeedStandard = KalloSpacing.sp2; // 8
