/// Avatar (36) + its gap (12): where a post's content column starts. Everything
/// that has to line up with that column measures from here — the separator
/// between two posts and the skeleton's separator.
///
/// NOT the thread page's replies, and not its composer. A reply lines its
/// avatar up with the POST's avatar (`thread_body.dart`, `kReplyIndent`), so it
/// measures from the card's own padding rather than from this rail; the dock is
/// page chrome rather than a reply, so it starts at the page's own padding.
const double kContentRail = 48;
