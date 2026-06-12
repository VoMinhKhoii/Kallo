import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../data/api_client.dart';
import '../../../models/meal.dart';
import '../../../models/streaming.dart';
import '../../../shared/widgets/nham_text.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../data/logging_keys.dart';
import '../data/logging_models.dart';
import '../data/logging_providers.dart';
import '../../dashboard/data/dashboard_providers.dart' as dash;
import '../../dashboard/logic/dashboard_format.dart' show formatCount;
import '../data/stream_analysis_controller.dart';
import '../logic/format.dart';
import '../logic/meal_utils.dart' show isLikelyPartialDay;
import 'calorie_ring.dart';
import 'dashed_divider.dart';
import 'empty_state.dart';
import 'entrances.dart';
import 'meal_entry.dart';
import 'meal_input.dart';
import 'persisted_meal_card.dart';
import 'streaming_entry.dart';
import 'timeline_rail.dart';

const _uuid = Uuid();

/// The day's meal feed: macro summary header, the scrollable card list, the
/// pending/streaming footer, and the natural-language meal input.
///
/// Ported 1:1 from `apps/mobile/src/components/logging/feed/feed-area.tsx`.
class FeedArea extends ConsumerStatefulWidget {
  const FeedArea({super.key, required this.profile, required this.date});

  final LoggingProfile profile;
  final String date;

  @override
  ConsumerState<FeedArea> createState() => _FeedAreaState();
}

class _FeedAreaState extends ConsumerState<FeedArea> {
  final MealInputController _inputController = MealInputController();

  /// Scrolls the freshly-revealed answer into view (nothing scrolled it before).
  final ScrollController _scrollController = ScrollController();

  /// The text of the run currently in flight — restored to the composer if it
  /// fails, so a failed analysis never destroys what the user typed.
  String? _inFlightText;

  /// A failed attempt, rendered as a feed card with "Try again" (terracotta).
  String? _failedText;

  /// The raw text of the just-revealed answer — shown as the morph card's Lora
  /// quote so the confirmable card carries the user's own words, not a derived
  /// meal name (the streaming→reveal→persisted object stays continuous).
  String? _revealRawInput;

  /// Inline error for a failed confirm (saving a meal) — not analysis errors,
  /// which surface as the failed-attempt card.
  String? _errorText;

  /// Meals swiped away but still inside the undo window. They are filtered out
  /// of the rendered feed (so a mid-window refetch can't resurrect the card)
  /// without ever mutating the day cache — Undo just removes the id, and a
  /// failed DELETE removes it too (the data was never locally changed).
  final Set<String> _pendingRemovalIds = <String>{};

  LoggingDayArgs get _dayArgs =>
      LoggingDayArgs(widget.profile.userId, widget.date);

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  /// Bring the footer (streaming card / revealed answer) into view.
  void _scrollToAnswer() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 400),
        curve: const Cubic(0.16, 1, 0.3, 1),
      );
    });
  }

  void _submit(String text) {
    setState(() {
      _failedText = null;
      _revealRawInput = null;
      _inFlightText = text;
    });
    _inputController.clear();
    _scrollToAnswer();
    ref
        .read(streamAnalysisProvider.notifier)
        .analyze(
          StreamAnalyzeInput(
            message: text,
            loggedDate: widget.date,
            timezoneOffset: timezoneOffsetMinutes(),
          ),
        );
  }

  void _retry() {
    final text = _failedText;
    if (text == null) return;
    _submit(text);
  }

  /// Trailing-swipe removal of a saved meal: the day visibly heals (the meal
  /// drops out of the totals immediately) with a 5-second undo. The DELETE only
  /// fires if the undo window closes. The day cache is never locally mutated —
  /// the meal id sits in [_pendingRemovalIds] and is filtered out of the
  /// rendered feed, so undo, refetch races, and failed deletes all resolve by
  /// just adding/removing the id. No confirm modal; nothing is destroyed
  /// within the grace window.
  void _removeMeal(PersistedMeal meal) {
    setState(() => _pendingRemovalIds.add(meal.id));

    var undone = false;
    final messenger = ScaffoldMessenger.of(context);
    messenger.clearSnackBars();
    messenger
        .showSnackBar(
          SnackBar(
            duration: const Duration(seconds: 5),
            content: NhamText(
              'logging.mealRemoved'.tr(),
              variant: NhamTextVariant.body,
              style: const TextStyle(color: NhamColors.surface),
            ),
            action: SnackBarAction(
              label: 'logging.undo'.tr(),
              textColor: NhamColors.accent,
              onPressed: () {
                undone = true;
                if (mounted) {
                  setState(() => _pendingRemovalIds.remove(meal.id));
                }
              },
            ),
          ),
        )
        .closed
        .then((_) async {
      if (undone || !mounted) return;
      try {
        await ref.read(apiClientProvider).delete<void>(
              '/api/v1/meals/${Uri.encodeComponent(meal.id)}',
            );
      } catch (_) {
        // The server rejected the delete — releasing the id makes the card
        // reappear (the cache was never mutated), keeping the feed truthful.
        if (mounted) {
          setState(() {
            _pendingRemovalIds.remove(meal.id);
            _errorText = 'errors.internal'.tr();
          });
        }
        return;
      }
      if (!mounted) return;
      // The delete landed — heal every cache that carries this date before
      // releasing the id, so the refetched day (sans meal) is what renders.
      ref.invalidate(mealDatesProvider(widget.profile.userId));
      ref.invalidate(dash.dashboardBundleProvider(
        (userId: widget.profile.userId, date: widget.date),
      ));
      ref.invalidate(dash.dashboardDayProvider(
        (userId: widget.profile.userId, date: widget.date),
      ));
      try {
        await ref.read(loggingDayProvider(_dayArgs).notifier).refresh();
      } catch (_) {
        // The refetch failing doesn't un-delete the meal — keep the id
        // filtered (a harmless no-op once a later fetch succeeds).
        return;
      }
      if (mounted) setState(() => _pendingRemovalIds.remove(meal.id));
    });
  }

  /// Pull-to-refresh: refetch the day + the meal-dates strip. Awaited so the
  /// platform refresh control holds its spinner until the data settles.
  Future<void> _refresh() async {
    ref.invalidate(mealDatesProvider(widget.profile.userId));
    await ref.read(loggingDayProvider(_dayArgs).notifier).refresh();
  }

  void _handleSuggestion(String s) {
    _inputController.setText(s);
    _inputController.focus();
  }

  void _onStreamChange(StreamAnalysisState? prev, StreamAnalysisState next) {
    // On completion: hold the stream alive and let the streaming card morph in
    // place into a confirmable answer (the reveal — per-row macros already real,
    // totals count up, spinner row swaps for Edit/Confirm). One light impact
    // marks the moment the answer lands; nothing unmounts. The refetch + reset
    // happens only once the user confirms (_confirmReveal).
    if (next.status == StreamStatus.done &&
        next.analysisId != null &&
        prev?.status != StreamStatus.done) {
      _revealRawInput = _inFlightText;
      _inFlightText = null;
      HapticFeedback.lightImpact();
      _scrollToAnswer();
    }
    // On error: never destroy the typed meal. Restore the raw text into the
    // composer AND render the failed attempt as a feed card (Try again).
    if (next.status == StreamStatus.error) {
      final text = _inFlightText;
      setState(() {
        _failedText = text;
        _inFlightText = null;
      });
      if (text != null && _inputController.getText().trim().isEmpty) {
        _inputController.setText(text);
      }
      ref.read(streamAnalysisProvider.notifier).reset();
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<StreamAnalysisState>(streamAnalysisProvider, _onStreamChange);

    final profile = widget.profile;
    final stream = ref.watch(streamAnalysisProvider);
    final dayAsync = ref.watch(loggingDayProvider(_dayArgs));
    final confirmPending = ref.watch(confirmMealProvider(profile.userId));

    final day = dayAsync.valueOrNull;
    final isLoading = dayAsync.isLoading;

    // Swiped-away meals inside the undo window are filtered out here (not
    // removed from the cache), so totals heal immediately and a mid-window
    // refetch cannot resurrect the card.
    final persistedMeals = (day?.persistedMeals ?? const <PersistedMeal>[])
        .where((m) => !_pendingRemovalIds.contains(m.id))
        .toList()
      ..sort((a, b) => a.loggedAt.compareTo(b.loggedAt));
    final pendingConfirmations =
        day?.pendingConfirmations ?? const <PendingMealConfirmation>[];

    // Legacy meals can carry unknown macros — when any do, the daily summary
    // can't be totalled honestly, so we show a quiet note instead of the ring.
    final hasUnknownDailyMacros = persistedMeals.any((m) =>
        m.nutrition.caloriesKcal == null ||
        m.nutrition.proteinG == null ||
        m.nutrition.carbohydrateG == null ||
        m.nutrition.fatG == null);

    final isStreaming =
        stream.status != StreamStatus.idle &&
        stream.status != StreamStatus.done &&
        stream.status != StreamStatus.error;

    // The completed-but-not-yet-confirmed answer, held in place as a morph of
    // the streaming card (built from the locally-held stream.result).
    final isRevealing =
        stream.status == StreamStatus.done &&
        stream.result != null &&
        stream.analysisId != null;

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

    final hasFailedAttempt = _failedText != null;

    final isEmpty =
        !isLoading &&
        persistedMeals.isEmpty &&
        pendingConfirmations.isEmpty &&
        !isStreaming &&
        !isRevealing &&
        !hasFailedAttempt;

    final hasFooterItems = pendingConfirmations.isNotEmpty ||
        isStreaming ||
        isRevealing ||
        hasFailedAttempt;

    // A past day with real meals but under half the target reads as
    // under-logged; the trends set it aside, so we say so (and offer to fold it
    // back in by adding what was missed). Only when nothing is mid-flight.
    final isPastDay = widget.date.compareTo(todayDateString()) < 0;
    final showPartialDayNotice = isPastDay &&
        !isLoading &&
        !dayAsync.hasError &&
        !hasUnknownDailyMacros &&
        persistedMeals.isNotEmpty &&
        pendingConfirmations.isEmpty &&
        !isStreaming &&
        !isRevealing &&
        isLikelyPartialDay(dailyCalories.toDouble(), profile.calorieTarget);

    final macroBars = [
      _MacroBarData(
        'dashboard.protein'.tr(),
        dailyProtein,
        profile.proteinTargetG,
        NhamColors.macroProtein,
      ),
      _MacroBarData(
        'dashboard.carbs'.tr(),
        dailyCarbs,
        profile.carbsTargetG,
        NhamColors.macroCarbs,
      ),
      _MacroBarData(
        'dashboard.fat'.tr(),
        dailyFat,
        profile.fatTargetG,
        NhamColors.macroFat,
      ),
    ];

    final bottomInset = MediaQuery.of(context).padding.bottom;

    return Column(
      children: [
        // Macro summary — enters opacity + slide-down (350ms). While the day
        // query loads, the live ring/bars are replaced by a 2-col skeleton.
        FadeInUp(
          child: Container(
            color: NhamColors.surface,
            padding: const EdgeInsets.fromLTRB(
              NhamSpacing.sp3,
              NhamSpacing.sp3,
              NhamSpacing.sp3,
              NhamSpacing.sp2,
            ),
            child: isLoading
                ? const _MacroSummarySkeleton()
                : hasUnknownDailyMacros
                    // Some legacy meals have unknown macros — the day can't be
                    // totalled, so say so plainly instead of showing a wrong ring.
                    ? Align(
                        alignment: Alignment.centerLeft,
                        child: NhamText(
                          'logging.feedArea.legacyMacroWarning'.tr(),
                          variant: NhamTextVariant.small,
                          style: NhamTextStyles.sansMedium(
                            fontSize: NhamFontSize.eyebrow + 1,
                          ).copyWith(color: NhamColors.textMuted80),
                        ),
                      )
                    : Row(
                      children: [
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            CalorieRing(
                              current: dailyCalories.toDouble(),
                              target: profile.calorieTarget.toDouble(),
                            ),
                            const SizedBox(height: 4), // gap-1
                            NhamText(
                              '${formatCount(dailyCalories, context.locale.toString())} / ${formatCount(profile.calorieTarget, context.locale.toString())} kcal',
                              variant: NhamTextVariant.numCaption,
                            ),
                          ],
                        ),
                        const SizedBox(width: NhamSpacing.sp4), // gap-4
                        Expanded(
                          child: Column(
                            children: [
                              for (var i = 0; i < macroBars.length; i++) ...[
                                _MacroRow(data: macroBars[i]),
                                if (i != macroBars.length - 1)
                                  const SizedBox(
                                    height: NhamSpacing.sp2,
                                  ), // gap-2
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
          ),
        ),

        // Under-logged past day: a quiet note that it's set aside from trends.
        if (showPartialDayNotice)
          Padding(
            padding: const EdgeInsets.fromLTRB(
              NhamSpacing.sp3,
              0,
              NhamSpacing.sp3,
              NhamSpacing.sp2,
            ),
            child: _PartialDayNotice(
              calories: dailyCalories,
              target: profile.calorieTarget,
            ),
          ),

        // The card list.
        Expanded(
          child: _buildList(
            isEmpty: isEmpty,
            isLoading: isLoading,
            hasError: dayAsync.hasError,
            persistedMeals: persistedMeals,
            pendingConfirmations: pendingConfirmations,
            isStreaming: isStreaming,
            isRevealing: isRevealing,
            stream: stream,
            hasFooterItems: hasFooterItems,
            confirmPending: confirmPending,
            failedText: _failedText,
            onRetry: _retry,
            onDiscardFailed: () => setState(() => _failedText = null),
          ),
        ),

        if (_errorText != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(
              NhamSpacing.sp3,
              0,
              NhamSpacing.sp3,
              NhamSpacing.sp2,
            ),
            child: NhamText(
              _errorText!,
              variant: NhamTextVariant.small,
              style: const TextStyle(color: NhamColors.danger),
            ),
          ),

        Padding(
          padding: EdgeInsets.fromLTRB(
            NhamSpacing.sp3,
            NhamSpacing.sp2,
            NhamSpacing.sp3,
            bottomInset + NhamSpacing.sp2,
          ),
          child: MealInput(
            controller: _inputController,
            onSubmit: _submit,
            onCancel: () => ref.read(streamAnalysisProvider.notifier).cancel(),
            analyzing: stream.isAnalyzing,
          ),
        ),
      ],
    );
  }

  Widget _buildList({
    required bool isEmpty,
    required bool isLoading,
    required bool hasError,
    required List<PersistedMeal> persistedMeals,
    required List<PendingMealConfirmation> pendingConfirmations,
    required bool isStreaming,
    required bool isRevealing,
    required StreamAnalysisState stream,
    required bool hasFooterItems,
    required bool confirmPending,
    required String? failedText,
    required VoidCallback onRetry,
    required VoidCallback onDiscardFailed,
  }) {
    // Day fetch error → red alert card with retry (LoggingDayErrorState).
    if (hasError && persistedMeals.isEmpty && !hasFooterItems) {
      return _LoggingDayErrorState(
        onRetry: () => ref.invalidate(loggingDayProvider(_dayArgs)),
      );
    }

    // FlatList contentContainerStyle: empty → centered with vertical padding;
    // populated → padding 12 + extra left gutter of 24 (for the timeline rail).
    if (persistedMeals.isEmpty) {
      final Widget body;
      if (isEmpty) {
        body = EmptyState(onSuggestion: _handleSuggestion);
      } else if (isLoading) {
        // 2-item card skeleton with the timeline rail (LoggingDaySkeleton).
        body = const _LoggingDaySkeleton();
      } else {
        body = const SizedBox.shrink();
      }

      // When there ARE footer items (pending/streaming) but no persisted meals,
      // the footer still renders with the gutter padding.
      if (hasFooterItems) {
        return SingleChildScrollView(
          controller: _scrollController,
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: const EdgeInsets.only(
            top: NhamSpacing.sp3,
            bottom: NhamSpacing.sp3,
            left: NhamSpacing.sp3 + NhamSpacing.sp6,
            right: NhamSpacing.sp3,
          ),
          child: _Footer(
            pendingConfirmations: pendingConfirmations,
            isStreaming: isStreaming,
            isRevealing: isRevealing,
            stream: stream,
            confirmPending: confirmPending,
            onConfirm: _confirm,
            onConfirmReveal: _confirmReveal,
            revealRawInput: _revealRawInput,
            failedText: failedText,
            onRetry: onRetry,
            onDiscardFailed: onDiscardFailed,
          ),
        );
      }

      // The loading skeleton sits in the timeline gutter (it carries its own
      // rail); the empty state is centered.
      if (isLoading) {
        return SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: const EdgeInsets.only(
            top: NhamSpacing.sp3,
            bottom: NhamSpacing.sp3,
            left: NhamSpacing.sp3 + NhamSpacing.sp6,
            right: NhamSpacing.sp3,
          ),
          child: body,
        );
      }

      return SingleChildScrollView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: NhamSpacing.sp6),
          child: Center(child: body),
        ),
      );
    }

    return RefreshIndicator.adaptive(
      onRefresh: _refresh,
      color: NhamColors.accent,
      child: ListView.separated(
      controller: _scrollController,
      physics: const AlwaysScrollableScrollPhysics(),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.only(
        top: NhamSpacing.sp3,
        bottom: NhamSpacing.sp3,
        left: NhamSpacing.sp3 + NhamSpacing.sp6, // padding + timeline gutter
        right: NhamSpacing.sp3,
      ),
      itemCount: persistedMeals.length + (hasFooterItems ? 1 : 0),
      separatorBuilder: (_, __) => const SizedBox(height: NhamSpacing.sp2),
      itemBuilder: (context, index) {
        if (index < persistedMeals.length) {
          final meal = persistedMeals[index];
          return FadeIn(
            key: ValueKey(meal.id),
            child: PersistedMealCard(
              meal: meal,
              isLast: !hasFooterItems && index == persistedMeals.length - 1,
              onRemove: () => _removeMeal(meal),
            ),
          );
        }
        return _Footer(
          pendingConfirmations: pendingConfirmations,
          isStreaming: isStreaming,
          isRevealing: isRevealing,
          stream: stream,
          confirmPending: confirmPending,
          onConfirm: _confirm,
          onConfirmReveal: _confirmReveal,
          revealRawInput: _revealRawInput,
          failedText: failedText,
          onRetry: onRetry,
          onDiscardFailed: onDiscardFailed,
        );
      },
      ),
    );
  }

  Future<void> _confirm(String analysisId, List<MealQuantityEdit> edits) async {
    try {
      await ref
          .read(confirmMealProvider(widget.profile.userId).notifier)
          .confirm(
            analysisId: analysisId,
            mealId: _uuid.v4(),
            originDate: widget.date,
            edits:
                edits.isEmpty
                    ? null
                    : [
                      for (final e in edits)
                        {
                          'mealItemOrder': e.mealItemOrder,
                          'newGrams': e.newGrams,
                        },
                    ],
          );
      // Saved — a success haptic confirms the meal landed.
      HapticFeedback.mediumImpact();
    } catch (_) {
      // confirm() rolls the optimistic removal back on failure; surface the
      // error too so it isn't silently swallowed.
      if (mounted) setState(() => _errorText = 'errors.internal'.tr());
    }
  }

  /// Confirm straight from the revealed answer (the morph card). The analysis is
  /// already stored server-side (analysis_complete); confirming persists it. On
  /// success we tear down the local stream so the revealed card hands off to the
  /// refetched persisted card — one continuous object from typed words to saved
  /// meal. On failure the stream stays so the user can retry the confirm.
  Future<void> _confirmReveal(
      String analysisId, List<MealQuantityEdit> edits) async {
    try {
      await ref
          .read(confirmMealProvider(widget.profile.userId).notifier)
          .confirm(
            analysisId: analysisId,
            mealId: _uuid.v4(),
            originDate: widget.date,
            edits: edits.isEmpty
                ? null
                : [
                    for (final e in edits)
                      {
                        'mealItemOrder': e.mealItemOrder,
                        'newGrams': e.newGrams,
                      },
                  ],
          );
      HapticFeedback.mediumImpact();
      _revealRawInput = null;
      ref.read(streamAnalysisProvider.notifier).reset();
    } catch (_) {
      if (mounted) setState(() => _errorText = 'errors.internal'.tr());
    }
  }
}

class _Footer extends StatelessWidget {
  const _Footer({
    required this.pendingConfirmations,
    required this.isStreaming,
    required this.isRevealing,
    required this.stream,
    required this.confirmPending,
    required this.onConfirm,
    required this.onConfirmReveal,
    required this.revealRawInput,
    required this.failedText,
    required this.onRetry,
    required this.onDiscardFailed,
  });

  final List<PendingMealConfirmation> pendingConfirmations;
  final bool isStreaming;
  final bool isRevealing;
  final String? revealRawInput;
  final StreamAnalysisState stream;
  final bool confirmPending;
  final void Function(String analysisId, List<MealQuantityEdit> edits)
  onConfirm;
  final void Function(String analysisId, List<MealQuantityEdit> edits)
  onConfirmReveal;
  final String? failedText;
  final VoidCallback onRetry;
  final VoidCallback onDiscardFailed;

  @override
  Widget build(BuildContext context) {
    final hasFailed = failedText != null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < pendingConfirmations.length; i++)
          MealEntry(
            key: ValueKey(pendingConfirmations[i].id),
            rawInput: pendingConfirmations[i].rawInput,
            parsedMeal: pendingConfirmations[i].parsedMeal,
            busy: confirmPending,
            isLast: !isStreaming &&
                !isRevealing &&
                !hasFailed &&
                i == pendingConfirmations.length - 1,
            onConfirm: (edits) => onConfirm(pendingConfirmations[i].id, edits),
          ),
        if (isStreaming)
          StreamingEntry(
            status: stream.status,
            items: stream.items,
            completedItems: stream.completedItems,
            isLast: !hasFailed,
          ),
        // The completed answer, morphed in place from the streaming card: the
        // per-row macros are already real, the totals count up, and the spinner
        // row has swapped for Edit/Confirm. Keyed by analysisId so it's the same
        // element across the streaming→done transition (no remount).
        if (isRevealing)
          MealEntry(
            key: ValueKey('reveal-${stream.analysisId}'),
            rawInput: revealRawInput ?? '',
            parsedMeal: stream.result!,
            busy: confirmPending,
            revealing: true,
            isLast: !hasFailed,
            onConfirm: (edits) => onConfirmReveal(stream.analysisId!, edits),
          ),
        if (hasFailed)
          _FailedAttemptCard(
            rawInput: failedText!,
            onRetry: onRetry,
            onDiscard: onDiscardFailed,
          ),
      ],
    );
  }
}

/// A failed analysis, rendered as a feed card so the attempt is never lost: the
/// raw input as a Lora quote, a terracotta one-liner, and "Try again" as the
/// primary action (with a quiet Discard). The raw text is also restored to the
/// composer — this card is the visible record of what happened.
class _FailedAttemptCard extends StatelessWidget {
  const _FailedAttemptCard({
    required this.rawInput,
    required this.onRetry,
    required this.onDiscard,
  });

  final String rawInput;
  final VoidCallback onRetry;
  final VoidCallback onDiscard;

  @override
  Widget build(BuildContext context) {
    return TimelineRail(
      isLast: true,
      // A terracotta-ringed dot marks the failed entry (never red).
      dotChild: Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: NhamColors.elev,
          border: Border.all(color: NhamColors.danger, width: 2),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.only(bottom: NhamSpacing.sp3),
        child: Container(
          padding: const EdgeInsets.all(NhamSpacing.sp4),
          decoration: BoxDecoration(
            color: NhamColors.surface,
            borderRadius: BorderRadius.circular(NhamRadii.containerLg),
            border: Border.all(color: NhamColors.borderSoft),
            boxShadow: const [NhamShadows.sm],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              NhamText(
                rawInput,
                variant: NhamTextVariant.mealQuote,
                style: const TextStyle(fontSize: 17, height: 28 / 17),
              ),
              const SizedBox(height: NhamSpacing.sp3),
              NhamText(
                'logging.failedAttempt.message'.tr(),
                variant: NhamTextVariant.small,
                style: const TextStyle(color: NhamColors.danger),
              ),
              const SizedBox(height: NhamSpacing.sp4),
              Row(
                children: [
                  Expanded(
                    child: _RetryButton(onTap: onRetry),
                  ),
                  const SizedBox(width: NhamSpacing.sp2),
                  _DiscardButton(onTap: onDiscard),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Primary "Try again" — solid umber, mirroring the confirm button's resting
/// look (an honest re-run of the same meal).
class _RetryButton extends StatefulWidget {
  const _RetryButton({required this.onTap});
  final VoidCallback onTap;

  @override
  State<_RetryButton> createState() => _RetryButtonState();
}

class _RetryButtonState extends State<_RetryButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'logging.failedAttempt.tryAgain'.tr(),
      child: GestureDetector(
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
          decoration: BoxDecoration(
            color: _pressed ? NhamColors.btnHover : NhamColors.btn,
            borderRadius: BorderRadius.circular(NhamRadii.xl),
            boxShadow: [_pressed ? NhamShadows.md : NhamShadows.sm],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(LucideIcons.refreshCw, size: 14, color: Colors.white),
              const SizedBox(width: 6),
              NhamText(
                'logging.failedAttempt.tryAgain'.tr(),
                variant: NhamTextVariant.body,
                style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.xs)
                    .copyWith(color: Colors.white),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Quiet "Discard" — wires the previously-unused logging.discard string.
class _DiscardButton extends StatefulWidget {
  const _DiscardButton({required this.onTap});
  final VoidCallback onTap;

  @override
  State<_DiscardButton> createState() => _DiscardButtonState();
}

class _DiscardButtonState extends State<_DiscardButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'logging.discard'.tr(),
      child: GestureDetector(
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
          decoration: BoxDecoration(
            color: _pressed ? NhamColors.hover : Colors.transparent,
            borderRadius: BorderRadius.circular(NhamRadii.xl),
          ),
          child: NhamText(
            'logging.discard'.tr(),
            variant: NhamTextVariant.body,
            style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.xs)
                .copyWith(color: NhamColors.textMuted),
          ),
        ),
      ),
    );
  }
}

/// A past-day under-logged note: Lora-italic terracotta title + a DM Sans body
/// that names the gap and invites folding the day back in. Ported from the web
/// `PartialDayNotice` (the strings shipped translated but were never rendered).
class _PartialDayNotice extends StatelessWidget {
  const _PartialDayNotice({required this.calories, required this.target});

  final int calories;
  final int target;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.toString();
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(NhamSpacing.sp3),
      decoration: BoxDecoration(
        color: NhamColors.surface,
        borderRadius: BorderRadius.circular(NhamRadii.containerLg),
        border: Border.all(color: NhamColors.borderSoft),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          NhamText(
            'logging.feedArea.partialDayNotice.title'.tr(),
            variant: NhamTextVariant.italicAccent,
            style: const TextStyle(color: NhamColors.danger),
          ),
          const SizedBox(height: 4), // mt-1
          NhamText(
            'logging.feedArea.partialDayNotice.body'.tr(namedArgs: {
              'calories': formatCount(calories, locale),
              'target': formatCount(target, locale),
            }),
            variant: NhamTextVariant.small,
            style: const TextStyle(color: NhamColors.textMuted),
          ),
        ],
      ),
    );
  }
}

class _MacroBarData {
  const _MacroBarData(this.label, this.current, this.target, this.color);
  final String label;
  final int current;
  final int target;
  final Color color;
}

class _MacroRow extends StatelessWidget {
  const _MacroRow({required this.data});
  final _MacroBarData data;

  @override
  Widget build(BuildContext context) {
    final pct =
        data.target > 0
            ? math
                .max(0, math.min(100, (data.current / data.target) * 100))
                .toDouble()
            : 0.0;
    return Row(
      children: [
        SizedBox(
          width: 48, // w-12
          child: NhamText(
            data.label,
            variant: NhamTextVariant.macroLabel,
            style: const TextStyle(color: NhamColors.textMuted70),
          ),
        ),
        const SizedBox(width: NhamSpacing.sp3), // gap-3
        Expanded(child: _MacroBar(pct: pct, color: data.color)),
        const SizedBox(width: NhamSpacing.sp3),
        SizedBox(
          width: 56, // w-14
          child: NhamText(
            '${data.current}/${data.target}g',
            variant: NhamTextVariant.macroValue,
          ),
        ),
      ],
    );
  }
}

/// A single macro bar whose fill sweeps 0→pct (1000ms, delay 200ms, easeOut).
class _MacroBar extends StatefulWidget {
  const _MacroBar({required this.pct, required this.color});
  final double pct;
  final Color color;

  @override
  State<_MacroBar> createState() => _MacroBarState();
}

class _MacroBarState extends State<_MacroBar>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  );
  late Animation<double> _anim = _build(0, widget.pct);

  Animation<double> _build(double from, double to) => Tween<double>(
    begin: from,
    end: to,
  ).chain(CurveTween(curve: Curves.easeOut)).animate(_c);

  @override
  void initState() {
    super.initState();
    Future<void>.delayed(const Duration(milliseconds: 200), () {
      if (mounted) _c.forward();
    });
  }

  @override
  void didUpdateWidget(_MacroBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.pct != widget.pct) {
      _anim = _build(_anim.value, widget.pct);
      _c
        ..reset()
        ..forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(NhamRadii.pill),
      child: Container(
        height: 6, // h-1.5
        color: NhamColors.track,
        child: AnimatedBuilder(
          animation: _anim,
          builder:
              (context, _) => FractionallySizedBox(
                alignment: Alignment.centerLeft,
                widthFactor: (_anim.value / 100).clamp(0, 1),
                child: Container(
                  decoration: BoxDecoration(
                    color: widget.color,
                    borderRadius: BorderRadius.circular(NhamRadii.pill),
                  ),
                ),
              ),
        ),
      ),
    );
  }
}

// ── Loading / error states ──────────────────────────────────────────────

/// A continuously pulsing wrapper (Tailwind animate-pulse: opacity 1→.5→1 over
/// 2s cubic-bezier(0.4,0,0.6,1)).
class _Pulse extends StatefulWidget {
  const _Pulse({required this.child});
  final Widget child;

  @override
  State<_Pulse> createState() => _PulseState();
}

class _PulseState extends State<_Pulse> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2000),
  )..repeat(reverse: true);
  late final Animation<double> _opacity = Tween<double>(
    begin: 0.5,
    end: 1,
  ).animate(CurvedAnimation(parent: _c, curve: const Cubic(0.4, 0, 0.6, 1)));

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      FadeTransition(opacity: _opacity, child: widget.child);
}

Widget _bar(double width, double height, Color color) => Container(
  width: width,
  height: height,
  decoration: BoxDecoration(
    color: color,
    borderRadius: BorderRadius.circular(NhamRadii.pill),
  ),
);

/// Macro header skeleton: a 2-col grid of 4 rounded-2xl border/50 bg-hover/25
/// tiles, each with a label bar + accent/25 value bar (MacroSummarySkeleton).
class _MacroSummarySkeleton extends StatelessWidget {
  const _MacroSummarySkeleton();

  static const _labelWidths = [64.0, 52.0, 58.0, 48.0];

  @override
  Widget build(BuildContext context) {
    Widget tile(int i) => Container(
      padding: const EdgeInsets.all(NhamSpacing.sp3), // p-3
      decoration: BoxDecoration(
        color: const Color(0x40F0EAE0), // bg-nham-hover/25
        borderRadius: BorderRadius.circular(NhamRadii.containerLg), // 2xl
        border: Border.all(color: NhamColors.borderHalf), // border/50
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _bar(_labelWidths[i], 12, const Color(0xB3E8D5B5)), // border/70
          const SizedBox(height: NhamSpacing.sp2), // mb-2
          _bar(64, 20, NhamColors.accent35), // h-5 w-16 accent/25
        ],
      ),
    );

    return _Pulse(
      child: Column(
        children: [
          Row(
            children: [
              Expanded(child: tile(0)),
              const SizedBox(width: NhamSpacing.sp3), // gap-3
              Expanded(child: tile(1)),
            ],
          ),
          const SizedBox(height: NhamSpacing.sp3),
          Row(
            children: [
              Expanded(child: tile(2)),
              const SizedBox(width: NhamSpacing.sp3),
              Expanded(child: tile(3)),
            ],
          ),
        ],
      ),
    );
  }
}

/// Day-loading skeleton: 2 pulsing ghost cards with the timeline rail, a title
/// bar, 3 text lines, and a dashed-top totals row (LoggingDaySkeleton).
class _LoggingDaySkeleton extends StatelessWidget {
  const _LoggingDaySkeleton();

  @override
  Widget build(BuildContext context) {
    Widget ghostCard(bool isLast) => TimelineRail(
      isLast: isLast,
      dotChild: Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: NhamColors.surface,
          border: Border.all(color: NhamColors.accent60, width: 2),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.only(bottom: NhamSpacing.sp8), // gap-8
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _bar(64, 12, const Color(0xB3E8D5B5)), // border/70 time bar
            const SizedBox(height: NhamSpacing.sp2), // mb-2
            Container(
              padding: const EdgeInsets.all(NhamSpacing.sp4), // p-5→16
              decoration: BoxDecoration(
                color: const Color(0x33F0EAE0), // bg-nham-hover/20
                borderRadius: BorderRadius.circular(
                  NhamRadii.containerLg,
                ), // 2xl
                border: Border.all(color: NhamColors.borderSoft), // /60
                boxShadow: const [NhamShadows.sm],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  LayoutBuilder(
                    builder:
                        (_, c) => _bar(
                          c.maxWidth * 2 / 3,
                          20,
                          const Color(0xB3E8D5B5),
                        ),
                  ),
                  const SizedBox(height: NhamSpacing.sp4), // mb-4
                  LayoutBuilder(
                    builder:
                        (_, c) => _bar(c.maxWidth, 12, NhamColors.borderSoft),
                  ),
                  const SizedBox(height: NhamSpacing.sp2),
                  LayoutBuilder(
                    builder:
                        (_, c) =>
                            _bar(c.maxWidth * 5 / 6, 12, NhamColors.borderHalf),
                  ),
                  const SizedBox(height: NhamSpacing.sp2),
                  LayoutBuilder(
                    builder:
                        (_, c) => _bar(
                          c.maxWidth * 3 / 5,
                          12,
                          NhamColors.borderBiscotti40,
                        ),
                  ),
                  const SizedBox(height: NhamSpacing.sp5), // mt-5
                  const DashedDivider(color: NhamColors.borderHalf),
                  const SizedBox(height: NhamSpacing.sp3), // pt-3
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _bar(112, 12, NhamColors.borderHalf), // w-28
                      _bar(64, 16, NhamColors.accent35), // accent/25
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );

    return _Pulse(child: Column(children: [ghostCard(false), ghostCard(true)]));
  }
}

/// Day fetch error: a red alert card with an AlertCircle, title/desc, and a
/// retry pill whose icon spins while refetching (LoggingDayErrorState).
class _LoggingDayErrorState extends StatelessWidget {
  const _LoggingDayErrorState({required this.onRetry});
  final VoidCallback onRetry;

  static const _red50 = Color(0xCCFEF2F2); // bg-red-50/80
  static const _red200 = Color(0xB3FECACA); // border-red-200/70
  static const _red600 = Color(0xFFDC2626);
  static const _red950 = Color(0xFF450A0A);
  static const _red900 = Color(0xCC7F1D1D); // red-900/80
  static const _red100 = Color(0xFFFEE2E2);

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(NhamSpacing.sp6),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 448), // max-w-md
          padding: const EdgeInsets.all(NhamSpacing.sp4), // p-4
          decoration: BoxDecoration(
            color: _red50,
            borderRadius: BorderRadius.circular(NhamRadii.containerLg), // 2xl
            border: Border.all(color: _red200),
            boxShadow: const [NhamShadows.sm],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.only(top: 2), // mt-0.5
                child: Icon(
                  LucideIcons.circleAlert, // lucide AlertCircle
                  size: 20,
                  color: _red600,
                ),
              ),
              const SizedBox(width: NhamSpacing.sp3), // gap-3
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    NhamText(
                      'logging.feedArea.loadErrorTitle'.tr(),
                      variant: NhamTextVariant.small,
                      style: NhamTextStyles.sansSemiBold(
                        fontSize: NhamFontSize.sm,
                      ).copyWith(color: _red950),
                    ),
                    const SizedBox(height: 4), // mt-1
                    NhamText(
                      'logging.feedArea.loadErrorDescription'.tr(),
                      variant: NhamTextVariant.small,
                      style: const TextStyle(color: _red900),
                    ),
                    const SizedBox(height: NhamSpacing.sp3), // mt-3
                    _RetryPill(onRetry: onRetry),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RetryPill extends StatelessWidget {
  const _RetryPill({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onRetry,
      child: Container(
        constraints: const BoxConstraints(minHeight: 36), // min-h-9
        padding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 8,
        ), // px-3.5 py-2
        decoration: BoxDecoration(
          color: _LoggingDayErrorState._red100,
          borderRadius: BorderRadius.circular(NhamRadii.pill),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              LucideIcons.refreshCw, // lucide RefreshCw
              size: 16,
              color: _LoggingDayErrorState._red950,
            ),
            const SizedBox(width: NhamSpacing.sp2), // gap-2
            NhamText(
              'logging.feedArea.retryDay'.tr(),
              variant: NhamTextVariant.small,
              style: NhamTextStyles.sansMedium(
                fontSize: NhamFontSize.sm,
              ).copyWith(color: _LoggingDayErrorState._red950),
            ),
          ],
        ),
      ),
    );
  }
}
