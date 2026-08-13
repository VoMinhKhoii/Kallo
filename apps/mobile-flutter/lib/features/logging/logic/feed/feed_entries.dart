import '../../data/logging_models.dart';

/// One meal-shaped row of the day: a meal already saved, or an analysis the
/// server has staged and the user hasn't confirmed yet.
///
/// The two used to render in separate blocks — every saved meal, then every
/// staged one beneath them — so confirming the middle of three staged meals
/// moved it to the TOP of the day while its neighbours stayed put, and every
/// card around it remounted as the blocks resized. They are the same thing at
/// the same instant (a confirmed meal inherits the analysis's timestamp
/// verbatim — `confirm-and-save.ts` reads `pending.loggedAt`), so the feed
/// interleaves them by time and a save changes one card in place.
sealed class FeedEntry {
  const FeedEntry();

  /// The card's list identity. It changes when a staged analysis becomes a
  /// saved meal — the analysis id gives way to the meal id, and they really are
  /// different cards — but every OTHER entry keeps its key and its slot, so
  /// nothing around the save is torn down.
  String get id;

  /// When the meal was logged, in UTC, for ordering.
  DateTime get loggedAt;
}

/// A meal already persisted for the day.
final class SavedEntry extends FeedEntry {
  const SavedEntry(this.meal);

  final PersistedMeal meal;

  @override
  String get id => meal.id;

  @override
  DateTime get loggedAt => _parseUtc(meal.loggedAt);
}

/// An analysis staged server-side, still awaiting its confirm tap.
final class StagedEntry extends FeedEntry {
  const StagedEntry(this.pending);

  final PendingMealConfirmation pending;

  @override
  String get id => pending.id;

  @override
  DateTime get loggedAt => _parseUtc(pending.loggedAt);
}

/// The day's cards in the order the meals happened, oldest first.
///
/// Staged rows carrying neither a parsed meal nor a cheat spec are dropped
/// rather than rendered: such a row draws nothing, so keeping it would leave a
/// gap in the feed with no card in it.
List<FeedEntry> buildFeedEntries({
  required List<PersistedMeal> saved,
  required List<PendingMealConfirmation> staged,
}) =>
    <FeedEntry>[
      for (final meal in saved) SavedEntry(meal),
      for (final pending in staged)
        if (pending.parsedMeal != null || pending.cheatSpec != null)
          StagedEntry(pending),
    ]..sort((a, b) {
      final byTime = a.loggedAt.compareTo(b.loggedAt);
      // Ids only break ties, and only so the order is stable across rebuilds —
      // two meals logged in the same millisecond must not swap places.
      return byTime != 0 ? byTime : a.id.compareTo(b.id);
    });

/// Both timestamps arrive from the server as `toISOString()`, but a row can be
/// written locally without a zone; parsing rather than comparing the strings
/// keeps saved and staged comparable either way. An unparseable stamp sorts
/// last instead of throwing mid-frame.
DateTime _parseUtc(String iso) =>
    DateTime.tryParse(iso)?.toUtc() ?? DateTime.utc(9999);
