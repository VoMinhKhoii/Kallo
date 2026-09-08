/// Circle's shared layout metrics — the numbers the feed, the day card, the
/// thread page and the loading skeleton all have to agree on.
///
/// They live in `logic/` rather than in whichever widget happens to draw them
/// first (`.agents/skills/kallo-design/mobile.md`, "Name the surface's gaps in
/// one constants file"). [kContentRail] was declared in `feed_day_group.dart`
/// and imported by three files in two other folders, which made the loading
/// skeleton depend on the day card it stands in for.
///
/// The feed's ink-to-ink vertical rhythm is a separate, feed-only concern and
/// stays in `widgets/feed/feed_rhythm.dart`.
library;

/// Avatar (32) + its gap (12): where a post's content column starts.
///
/// Everything that has to line up with that column measures from here — the
/// separator between two posts in a day card, the thread page's reply indent
/// and its composer's avatar (both `sp4 + kContentRail`, the card's own pad on
/// top of the rail), and the skeleton's separator, so the placeholder rows sit
/// exactly where the real posts will.
const double kContentRail = 44;
