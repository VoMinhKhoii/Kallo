/// The order Recent meals reads in.
///
/// Newest first. The server already returns the day this way
/// (`lib/actions/meals/load-meals.ts` — `orderBy(desc(meals.loggedAt))`) and
/// the web dock renders that untouched; the client sorts anyway so an
/// optimistically inserted meal lands where it belongs instead of at whatever
/// index the cache write put it.
///
/// It used to sort ASCENDING, which put the meal you just logged at the bottom
/// of the card and disagreed with web on the same account.
library;

import '../data/logging_day.dart';

/// [meals] newest-first, as a new list — the caller's list is never mutated.
///
/// `loggedAt` is ISO-8601, so lexicographic descending IS reverse chronological
/// (see `PersistedMeal.loggedAt`).
List<PersistedMeal> mealsNewestFirst(List<PersistedMeal> meals) =>
    [...meals]..sort((a, b) => b.loggedAt.compareTo(a.loggedAt));
