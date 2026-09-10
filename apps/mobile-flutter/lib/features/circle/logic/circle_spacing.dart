/// Avatar (32) + its gap (12): where a post's content column starts. Everything
/// that has to line up with that column measures from here — the separator
/// between two posts, the thread page's reply indent (`sp4 + kContentRail`)
/// and the skeleton's separator. NOT the thread composer: that dock is page
/// chrome rather than a reply, so it starts at the page's own padding.
const double kContentRail = 44;
