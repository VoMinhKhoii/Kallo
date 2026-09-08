/// Finding one Circle post by share id inside a loaded list of entries.
library;

import '../../../models/social/circle.dart';

/// The entry whose meal carries [shareId], or null when [entries] has none
/// (a null list is treated as an empty one, so a feed that has not resolved
/// answers "not here" rather than throwing).
///
/// A plain loop rather than `firstWhereOrNull`: the `collection` package is
/// not a dependency of this app, so this is the ONE hand-rolled lookup every
/// caller shares instead of writing its own.
CircleFeedEntry? findShareEntry(
  Iterable<CircleFeedEntry>? entries,
  String shareId,
) {
  for (final entry in entries ?? const <CircleFeedEntry>[]) {
    if (entry.meal.shareId == shareId) return entry;
  }
  return null;
}
