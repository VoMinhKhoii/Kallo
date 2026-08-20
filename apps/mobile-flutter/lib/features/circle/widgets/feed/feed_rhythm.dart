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

/// How much of the nutrition page's bar this surface spends.
///
/// That page draws one bar per screen; the feed draws one per post, so the same
/// mark repeated down a list read as candy stripes at full weight. A shorter
/// bar, a visible gutter between segments, and pigment pulled back toward the
/// page — the three knobs to reach for if it reads heavy, before touching the
/// palette itself.
///
/// Height is a trade in both directions: at 4 the bar is 80:1 and reads as a
/// decorative rule under the calorie figure rather than as a composition; 6
/// keeps it quiet while still reading as three parts of something.
const double kFeedBarHeight = 6;
const double kFeedBarGap = 2;
const double kFeedBarOpacity = 0.8;
