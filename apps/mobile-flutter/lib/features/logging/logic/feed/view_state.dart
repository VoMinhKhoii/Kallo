import '../../../../models/logging/streaming.dart';
import '../../data/logging_keys.dart';
import '../../data/logging_models.dart';
import '../../data/stream_analysis_controller.dart';
import '../format.dart';
import '../meal_utils.dart' show isLikelyPartialDay;
import 'feed_entries.dart';

/// Everything the day's feed renders off, derived once per frame from the day
/// query, the live analysis stream and the composer's local attempt state.
///
/// Pure by construction (no ref, no context, no widgets) so the branches it
/// decides — empty vs loading vs error, which cards the footer carries, whether
/// the day reads as under-logged — can be reasoned about, and so the widgets
/// below it stay presentational.
class FeedViewState {
  const FeedViewState({
    required this.persistedMeals,
    required this.pendingConfirmations,
    required this.entries,
    required this.isLoading,
    required this.hasError,
    required this.hasUnknownDailyMacros,
    required this.isStreaming,
    required this.isRevealing,
    required this.isCheatRevealing,
    required this.dailyCalories,
    required this.dailyProtein,
    required this.dailyCarbs,
    required this.dailyFat,
    required this.hasFailedAttempt,
    required this.isEmpty,
    required this.hasLiveTail,
    required this.showPartialDayNotice,
  });

  factory FeedViewState.from({
    required LoggingDayData? day,
    required bool dayIsLoading,
    required bool dayHasError,
    required StreamAnalysisState stream,
    required LoggingProfile profile,
    required String date,
    required Set<String> pendingRemovalIds,
    required bool hasFailedAttempt,
  }) {
    // Only show the skeleton on the FIRST load (no data yet). A refetch after
    // confirm/delete keeps the previous data on screen (react-query's
    // keepPreviousData), so saving slots the meal in instead of reloading the
    // whole feed.
    final isLoading = dayIsLoading && day == null;

    // Swiped-away meals inside the undo window are filtered out here (not
    // removed from the cache), so totals heal immediately and a mid-window
    // refetch cannot resurrect the card.
    final persistedMeals =
        (day?.persistedMeals ?? const <PersistedMeal>[])
            .where((m) => !pendingRemovalIds.contains(m.id))
            .toList()
          ..sort((a, b) => a.loggedAt.compareTo(b.loggedAt));
    // The revealed answer is already staged server-side, and the day is
    // refreshed the moment it lands so the card survives a hot reload or a
    // relaunch. Until the user confirms, that row and the reveal are the SAME
    // meal — render both and it appears twice.
    final revealedId = stream.status == StreamStatus.done ? stream.analysisId : null;
    // Oldest first, like persistedMeals above. The server hands these back
    // `ORDER BY logged_at DESC`, so taking them as-is put two unconfirmed meals
    // on screen in the opposite order to every other card in the day.
    final pendingConfirmations =
        (day?.pendingConfirmations ?? const <PendingMealConfirmation>[])
            .where((p) => p.id != revealedId)
            .toList()
          ..sort((a, b) => a.loggedAt.compareTo(b.loggedAt));

    // Legacy meals can carry unknown macros — when any do, the daily summary
    // can't be totalled honestly, so we show a quiet note instead of the ring.
    final hasUnknownDailyMacros = persistedMeals.any(
      (m) =>
          m.nutrition.caloriesKcal == null ||
          m.nutrition.proteinG == null ||
          m.nutrition.carbohydrateG == null ||
          m.nutrition.fatG == null,
    );

    // Pin the live stream/reveal cards to the day they were submitted on, so
    // switching the selected date doesn't render them on the wrong day's feed.
    final streamIsForThisDay = stream.loggedDate == date;

    final isStreaming =
        streamIsForThisDay &&
        stream.status != StreamStatus.idle &&
        stream.status != StreamStatus.done &&
        stream.status != StreamStatus.error;

    // The completed-but-not-yet-confirmed answer, held in place as a morph of
    // the streaming card (built from the locally-held stream.result).
    final isRevealing =
        streamIsForThisDay &&
        stream.status == StreamStatus.done &&
        stream.result != null &&
        stream.analysisId != null;

    // The cheat counterpart: a completed slider estimate (analysisId set) or a
    // clarifying question (no analysisId — nothing staged; the user re-asks).
    final isCheatRevealing =
        streamIsForThisDay &&
        stream.status == StreamStatus.done &&
        stream.cheatSpec != null;

    final dailyCalories = round0(
      persistedMeals.fold<double>(
        0,
        (s, m) => s + (m.nutrition.caloriesKcal ?? 0),
      ),
    );
    final dailyProtein = round0(
      persistedMeals.fold<double>(0, (s, m) => s + (m.nutrition.proteinG ?? 0)),
    );
    final dailyCarbs = round0(
      persistedMeals.fold<double>(
        0,
        (s, m) => s + (m.nutrition.carbohydrateG ?? 0),
      ),
    );
    final dailyFat = round0(
      persistedMeals.fold<double>(0, (s, m) => s + (m.nutrition.fatG ?? 0)),
    );

    // Saved and staged meals read as ONE list, ordered by when they were
    // logged. Kept apart, confirming a staged meal moved its card out of the
    // lower block and into the upper one — a save in the middle of the day
    // jumped to the top.
    final entries = buildFeedEntries(
      saved: persistedMeals,
      staged: pendingConfirmations,
    );

    // Only the live turn and a failed attempt live below the list now.
    final hasLiveTail =
        isStreaming || isRevealing || isCheatRevealing || hasFailedAttempt;

    final isEmpty = !isLoading && entries.isEmpty && !hasLiveTail;

    // A past day with real meals but under half the target reads as
    // under-logged; the trends set it aside, so we say so (and offer to fold it
    // back in by adding what was missed). Only when nothing is mid-flight.
    final isPastDay = date.compareTo(todayDateString()) < 0;
    final showPartialDayNotice =
        isPastDay &&
        !isLoading &&
        !dayHasError &&
        !hasUnknownDailyMacros &&
        persistedMeals.isNotEmpty &&
        pendingConfirmations.isEmpty &&
        !isStreaming &&
        !isRevealing &&
        !isCheatRevealing &&
        isLikelyPartialDay(dailyCalories.toDouble(), profile.calorieTarget);

    return FeedViewState(
      persistedMeals: persistedMeals,
      pendingConfirmations: pendingConfirmations,
      entries: entries,
      isLoading: isLoading,
      hasError: dayHasError,
      hasUnknownDailyMacros: hasUnknownDailyMacros,
      isStreaming: isStreaming,
      isRevealing: isRevealing,
      isCheatRevealing: isCheatRevealing,
      dailyCalories: dailyCalories,
      dailyProtein: dailyProtein,
      dailyCarbs: dailyCarbs,
      dailyFat: dailyFat,
      hasFailedAttempt: hasFailedAttempt,
      isEmpty: isEmpty,
      hasLiveTail: hasLiveTail,
      showPartialDayNotice: showPartialDayNotice,
    );
  }

  /// The day's saved meals, oldest first, minus the ones inside an undo window.
  final List<PersistedMeal> persistedMeals;

  /// Analyses the server has staged but the user hasn't confirmed yet.
  final List<PendingMealConfirmation> pendingConfirmations;

  /// The day's cards — saved and staged interleaved, oldest first. What the
  /// feed list actually renders; the two lists above are the ingredients.
  final List<FeedEntry> entries;

  /// First load only — a refetch keeps the previous day on screen.
  final bool isLoading;
  final bool hasError;

  /// Some legacy meal is missing a macro, so the day can't be totalled.
  final bool hasUnknownDailyMacros;

  final bool isStreaming;
  final bool isRevealing;
  final bool isCheatRevealing;

  final int dailyCalories;
  final int dailyProtein;
  final int dailyCarbs;
  final int dailyFat;

  final bool hasFailedAttempt;

  /// Nothing saved, staged, in flight or failed — the empty state's day.
  final bool isEmpty;

  /// Something is happening below the day's cards — an analysis streaming, a
  /// revealed answer, or a failed attempt — so the list reserves a trailing
  /// slot for the footer.
  final bool hasLiveTail;

  final bool showPartialDayNotice;
}
