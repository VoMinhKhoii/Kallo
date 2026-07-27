import 'dart:async' show unawaited;
import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../data/api_client.dart';
import '../../../models/cheat.dart';
import '../../../models/meal.dart';
import '../../../models/streaming.dart';
import '../../../shared/widgets/nham_text.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../data/logging_keys.dart';
import '../data/logging_models.dart';
import '../data/logging_providers.dart';
import '../../dashboard/logic/dashboard_format.dart' show formatCount;
import '../data/stream_analysis_controller.dart';
import '../logic/format.dart';
import '../logic/logging_spacing.dart';
import '../logic/meal_utils.dart' show isLikelyPartialDay;
import 'calorie_ring.dart';
import '../../../shared/widgets/top_toast.dart';
import '../../settings/controls/option_strip.dart';
import 'cheat_meal_card.dart';
import 'cheat_occasion_chips.dart';
import 'cheat_slider_card.dart';
import 'composer_dock.dart';
import 'empty_state.dart';
import 'entrances.dart';
import 'terminal/failed_attempt_card.dart';
import 'terminal/logging_day_error_state.dart';
import 'sheets/barcode_scanner_sheet.dart';
import 'sheets/manual_log_sheet.dart';
import 'meal_entry.dart';
import 'meal_input.dart';
import 'sheets/meal_mode_sheet.dart';
import 'persisted/persisted_meal_card.dart';
import '../data/persisted_meal_mutations.dart';
import 'streaming_entry.dart';

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

  /// The selected composer mode (the pill on the input bar). Normal and Cheat
  /// are persistent modes (matching web); manual and barcode are one-shot
  /// sheets that leave the persistent mode untouched.
  MealLogMode _mode = MealLogMode.normal;

  /// Indulgence magnitude for cheat mode — scales the slider anchor grams
  /// server-side. Defaults to medium, like the web picker.
  CheatIntensity _cheatIntensity = CheatIntensity.medium;

  /// True while a "log it again" occasion is being re-staged server-side.
  bool _stagingRepeat = false;

  /// Scrolls the freshly-revealed answer into view (nothing scrolled it before).
  final ScrollController _scrollController = ScrollController();

  /// The text of the run currently in flight — restored to the composer if it
  /// fails, so a failed analysis never destroys what the user typed.
  String? _inFlightText;

  /// A failed attempt, rendered as a feed card with "Try again" (terracotta).
  String? _failedText;

  /// Whether the failed attempt is worth retrying (from the error's `retryable`
  /// flag). When false the failed card offers only Discard, no "Try again".
  bool _failedRetryable = true;

  /// Stable per-attempt id for the run currently on screen. Minted fresh on a
  /// new submit; REUSED for a retry of a failed attempt and for a cheat-clarify
  /// resubmit, so the server upserts one staging row instead
  /// of orphaning its predecessor. Cleared once the attempt is saved or
  /// discarded; kept on error so the retry supersedes. Mirrors the web
  /// attemptId semantics (use-feed-submit / use-confirm-handlers).
  String? _attemptId;

  /// The raw text of the just-revealed answer — shown as the morph card's Lora
  /// quote so the confirmable card carries the user's own words, not a derived
  /// meal name (the streaming→reveal→persisted object stays continuous).
  String? _revealRawInput;

  /// Inline error for a failed confirm (saving a meal) — not analysis errors,
  /// which surface as the failed-attempt card.
  String? _errorText;

  /// The floating composer dock's measured height — the scroll padding the
  /// feed reserves so its last card can always clear the dock it scrolls
  /// under. Seeded generously; [ComposerDock] reports the real value on the
  /// first frame.
  double _dockHeight = 120;

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
    // A fresh logging attempt: mint a new attempt id. Retries and cheat-clarify
    // resubmits reuse the existing id instead (see _retry / _clarifyCheat) so
    // the server upserts one staging row per attempt.
    _attemptId = _uuid.v4();
    _runAnalyze(text);
  }

  /// Core analyze path shared by fresh submit and retry. Honors the persistent
  /// composer [_mode] (precise vs cheat) and sends the current [_attemptId].
  void _runAnalyze(String text) {
    // A second submit while an unconfirmed reveal is showing must not
    // vaporize the first answer: that analysis is already stored server-side
    // as pending, so refresh its origin day — it resurfaces as a
    // pending-confirmation card.
    final prior = ref.read(streamAnalysisProvider);
    if (prior.status == StreamStatus.done && prior.analysisId != null) {
      final originDate = prior.loggedDate ?? widget.date;
      unawaited(
        ref
            .read(
              loggingDayProvider(
                LoggingDayArgs(widget.profile.userId, originDate),
              ).notifier,
            )
            .refresh(),
      );
    }
    setState(() {
      _failedText = null;
      // Kept in lockstep with _failedText (only read while _failedText != null);
      // reset it explicitly so the invariant holds without relying on the error
      // branch always rewriting both.
      _failedRetryable = true;
      _revealRawInput = null;
      _inFlightText = text;
    });
    _inputController.clear();
    _scrollToAnswer();
    final isCheat = _mode == MealLogMode.cheat;
    ref
        .read(streamAnalysisProvider.notifier)
        .analyze(
          StreamAnalyzeInput(
            message: text,
            loggedDate: widget.date,
            timezoneOffset: timezoneOffsetMinutes(),
            mode: isCheat ? 'cheat' : null,
            cheatIntensity: isCheat ? _cheatIntensity.name : null,
            attemptId: _attemptId,
          ),
        );
  }

  void _retry() {
    final text = _failedText;
    if (text == null) return;
    // Reuse the failed attempt's id so the retry supersedes its staging row
    // (kept on error precisely for this). Fall back to a fresh id defensively.
    _attemptId ??= _uuid.v4();
    _runAnalyze(text);
  }

  /// Discard a failed attempt: drop the card and retire its attempt id (the raw
  /// text stays in the composer to re-log by hand).
  void _discardFailed() {
    setState(() {
      _failedText = null;
      _attemptId = null;
    });
  }

  /// The first step: choose how to log. Normal and Cheat set the persistent
  /// composer mode and focus the field; Manual opens the search-and-grams
  /// sheet (a one-shot, not a persistent mode); Barcode opens the scanner
  /// sheet (also one-shot).
  Future<void> _openModeSheet() async {
    final picked = await showMealModeSheet(context, current: _mode);
    if (picked == null || !mounted) return;
    switch (picked) {
      case MealLogMode.normal:
        setState(() => _mode = MealLogMode.normal);
        _inputController.focus();
      case MealLogMode.manual:
        showManualLogSheet(
          context,
          userId: widget.profile.userId,
          date: widget.date,
        );
      case MealLogMode.barcode:
        _openBarcodeSheet();
      case MealLogMode.cheat:
        setState(() => _mode = MealLogMode.cheat);
        _inputController.focus();
    }
  }

  /// One-shot barcode scan → quantity → save. Unlike manual (which saves
  /// silently), barcode persists the meal in one server call with no pending
  /// card, so a success toast is the only confirmation the user gets.
  Future<void> _openBarcodeSheet() async {
    final saved = await showBarcodeScannerSheet(
      context,
      userId: widget.profile.userId,
      date: widget.date,
      // Product not found → the AI composer is the better tool: pop the sheet
      // and hand the user the keyboard.
      onFallbackToText: () => _inputController.focus(),
    );
    if (saved == true && mounted) {
      HapticFeedback.mediumImpact();
      showTopToast(context, 'logging.barcode.savedMeal'.tr());
    }
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
    // Top-anchored undo toast (every toast lives at the top now). Its future
    // resolves on dismissal — by Undo, tap, or timeout — mirroring the old
    // SnackBar.closed, so the delete still finalizes only after the window.
    showTopToast(
      context,
      'logging.mealRemoved'.tr(),
      actionLabel: 'logging.undo'.tr(),
      duration: const Duration(seconds: 5),
      onAction: () {
        undone = true;
        if (mounted) {
          setState(() => _pendingRemovalIds.remove(meal.id));
        }
      },
    ).then((_) async {
      if (undone || !mounted) return;
      try {
        await ref
            .read(apiClientProvider)
            .delete<void>('/api/v1/meals/${Uri.encodeComponent(meal.id)}');
      } catch (_) {
        // The server rejected the delete — releasing the id makes the card
        // reappear (the cache was never mutated), keeping the feed truthful.
        // Heal the day here (nothing refetches it after) plus the rest of the
        // canonical meal surfaces.
        invalidateMealSurfaces(
          ref.invalidate,
          widget.profile.userId,
          widget.date,
        );
        if (mounted) {
          setState(() {
            _pendingRemovalIds.remove(meal.id);
            _errorText = 'errors.internal'.tr();
          });
        }
        return;
      }
      if (!mounted) return;
      // The delete landed — heal every date-keyed surface before releasing the
      // id, then refetch the day itself (includeDay:false — the refresh below
      // owns it) so the refetched day (sans meal) is what renders.
      invalidateMealSurfaces(
        ref.invalidate,
        widget.profile.userId,
        widget.date,
        includeDay: false,
      );
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

  void _onStreamChange(StreamAnalysisState? prev, StreamAnalysisState next) {
    // On completion: hold the stream alive and let the streaming card morph in
    // place into a confirmable answer (the reveal — per-row macros already real,
    // totals count up, spinner row swaps for Edit/Confirm). One light impact
    // marks the moment the answer lands; nothing unmounts. The refetch + reset
    // happens only once the user confirms (_confirmReveal).
    // The cheat clarify terminal reaches done with a cheatSpec but NO
    // analysisId (nothing is staged for a vague input) — it still reveals as a
    // card, so it takes the same transition.
    if (next.status == StreamStatus.done &&
        (next.analysisId != null || next.cheatSpec != null) &&
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
        _failedRetryable = next.retryable;
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
    // Only show the skeleton on the FIRST load (no data yet). A refetch after
    // confirm/delete keeps the previous data on screen (react-query's
    // keepPreviousData), so saving slots the meal in instead of reloading the
    // whole feed.
    final isLoading = dayAsync.isLoading && day == null;

    // Swiped-away meals inside the undo window are filtered out here (not
    // removed from the cache), so totals heal immediately and a mid-window
    // refetch cannot resurrect the card.
    final persistedMeals =
        (day?.persistedMeals ?? const <PersistedMeal>[])
            .where((m) => !_pendingRemovalIds.contains(m.id))
            .toList()
          ..sort((a, b) => a.loggedAt.compareTo(b.loggedAt));
    final pendingConfirmations =
        day?.pendingConfirmations ?? const <PendingMealConfirmation>[];

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
    final streamIsForThisDay = stream.loggedDate == widget.date;

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

    final hasFailedAttempt = _failedText != null;

    final isEmpty =
        !isLoading &&
        persistedMeals.isEmpty &&
        pendingConfirmations.isEmpty &&
        !isStreaming &&
        !isRevealing &&
        !isCheatRevealing &&
        !hasFailedAttempt;

    final hasFooterItems =
        pendingConfirmations.isNotEmpty ||
        isStreaming ||
        isRevealing ||
        isCheatRevealing ||
        hasFailedAttempt;

    // A past day with real meals but under half the target reads as
    // under-logged; the trends set it aside, so we say so (and offer to fold it
    // back in by adding what was missed). Only when nothing is mid-flight.
    final isPastDay = widget.date.compareTo(todayDateString()) < 0;
    final showPartialDayNotice =
        isPastDay &&
        !isLoading &&
        !dayAsync.hasError &&
        !hasUnknownDailyMacros &&
        persistedMeals.isNotEmpty &&
        pendingConfirmations.isEmpty &&
        !isStreaming &&
        !isRevealing &&
        !isCheatRevealing &&
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

    return Column(
      children: [
        // Macro summary — enters opacity + slide-down (350ms). While the day
        // query loads, the live ring/bars are replaced by a 2-col skeleton.
        FadeInUp(
          child: Container(
            color: NhamColors.surface,
            padding: const EdgeInsets.fromLTRB(
              NhamSpacing.sp3,
              LoggingSpacing.block,
              NhamSpacing.sp3,
              LoggingSpacing.block,
            ),
            child:
                isLoading
                    ? const _MacroSummarySkeleton()
                    : hasUnknownDailyMacros
                    // Some legacy meals have unknown macros — the day can't be
                    // totalled, so say so plainly instead of showing a wrong ring.
                    ? Align(
                      alignment: Alignment.centerLeft,
                      child: NhamText(
                        'logging.feedArea.legacyMacroWarning'.tr(),
                        variant: NhamTextVariant.small,
                        style: dashMeta(),
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
              LoggingSpacing.block,
            ),
            child: _PartialDayNotice(
              calories: dailyCalories,
              target: profile.calorieTarget,
            ),
          ),

        // The card list, with the composer FLOATING over its bottom edge —
        // the feed scrolls under the dock (reserving `_dockHeight` so the last
        // card can always clear it) instead of stopping above a solid bar.
        Expanded(
          child: Stack(
            children: [
              Positioned.fill(
                child: _buildList(
                  isEmpty: isEmpty,
                  isLoading: isLoading,
                  hasError: dayAsync.hasError,
                  persistedMeals: persistedMeals,
                  pendingConfirmations: pendingConfirmations,
                  isStreaming: isStreaming,
                  isRevealing: isRevealing,
                  isCheatRevealing: isCheatRevealing,
                  stream: stream,
                  hasFooterItems: hasFooterItems,
                  confirmPending: confirmPending,
                  failedText: _failedText,
                  failedRetryable: _failedRetryable,
                  onRetry: _retry,
                  onDiscardFailed: _discardFailed,
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: ComposerDock(
                  onHeightChanged:
                      (height) => setState(() => _dockHeight = height),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Carries its own opaque chip: the dock is see-through,
                      // and this must stay readable over a scrolling feed.
                      if (_errorText != null)
                        Container(
                          margin: const EdgeInsets.only(
                            bottom: LoggingSpacing.block,
                          ),
                          padding: const EdgeInsets.symmetric(
                            horizontal: NhamSpacing.sp3,
                            vertical: NhamSpacing.sp2,
                          ),
                          decoration: BoxDecoration(
                            color: NhamColors.elev,
                            borderRadius: BorderRadius.circular(NhamRadii.xl),
                            border: Border.all(color: NhamColors.borderSoft),
                            boxShadow: const [NhamShadows.sm],
                          ),
                          child: NhamText(
                            _errorText!,
                            variant: NhamTextVariant.small,
                            style: dashMeta(color: NhamColors.danger),
                          ),
                        ),
                      // Cheat mode's per-meal controls sit above the composer:
                      // the light/medium/heavy intensity strip and the "log it
                      // again" chips (the web keeps both above the input too).
                      if (_mode == MealLogMode.cheat) ...[
                        CheatOccasionChips(
                          userId: widget.profile.userId,
                          disabled: _stagingRepeat || stream.isAnalyzing,
                          onSelect: _repeatCheat,
                        ),
                        _CheatIntensityRow(
                          value: _cheatIntensity,
                          onChange:
                              (intensity) =>
                                  setState(() => _cheatIntensity = intensity),
                        ),
                        const SizedBox(height: LoggingSpacing.block),
                      ],
                      MealInput(
                        controller: _inputController,
                        onSubmit: _submit,
                        onCancel:
                            () =>
                                ref
                                    .read(streamAnalysisProvider.notifier)
                                    .cancel(),
                        analyzing: stream.isAnalyzing,
                        modeLabel: mealModeLabel(_mode),
                        modeIcon: mealModeIcon(_mode),
                        hintText:
                            _mode == MealLogMode.cheat
                                ? 'logging.cheatPlaceholder'.tr()
                                : null,
                        onModePressed: _openModeSheet,
                        // iOS-only for now (matches the mode sheet's gating);
                        // null hides the composer icon entirely. Gated via the
                        // shared `isBarcodeLoggingSupported` (same source of
                        // truth as the mode sheet).
                        onBarcodePressed:
                            isBarcodeLoggingSupported
                                ? _openBarcodeSheet
                                : null,
                      ),
                    ],
                  ),
                ),
              ),
            ],
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
    required bool isCheatRevealing,
    required StreamAnalysisState stream,
    required bool hasFooterItems,
    required bool confirmPending,
    required String? failedText,
    required bool failedRetryable,
    required VoidCallback onRetry,
    required VoidCallback onDiscardFailed,
  }) {
    // Day fetch error → red alert card with retry (LoggingDayErrorState).
    if (hasError && persistedMeals.isEmpty && !hasFooterItems) {
      return Padding(
        // Centre the alert in the space the dock leaves, not behind it.
        padding: EdgeInsets.only(bottom: _dockHeight),
        child: LoggingDayErrorState(
          onRetry: () => ref.invalidate(loggingDayProvider(_dayArgs)),
        ),
      );
    }

    // Empty → centered with vertical padding; populated → symmetric 12 padding,
    // full-width cards (the old left timeline gutter is gone, matching web).
    if (persistedMeals.isEmpty) {
      final Widget body;
      if (isEmpty) {
        body = const EmptyState();
      } else if (isLoading) {
        // 2-item full-width card skeleton (LoggingDaySkeleton).
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
          // The macro block above owns the top gap; the bottom reserves the
          // floating dock's height so the last card can clear it.
          padding: EdgeInsets.fromLTRB(
            NhamSpacing.sp3,
            0,
            NhamSpacing.sp3,
            _dockHeight,
          ),
          child: _Footer(
            pendingConfirmations: pendingConfirmations,
            isStreaming: isStreaming,
            isRevealing: isRevealing,
            isCheatRevealing: isCheatRevealing,
            stream: stream,
            streamingRawInput: _inFlightText,
            confirmPending: confirmPending,
            onConfirm: _confirm,
            onConfirmReveal: _confirmReveal,
            onConfirmCheat: _confirmCheatPending,
            onConfirmCheatReveal: _confirmCheatReveal,
            onClarifyCheat: _clarifyCheat,
            revealRawInput: _revealRawInput,
            failedText: failedText,
            failedRetryable: failedRetryable,
            onRetry: onRetry,
            onDiscardFailed: onDiscardFailed,
          ),
        );
      }

      // The loading skeleton uses the same symmetric padding as the real cards;
      // the empty state is centered.
      if (isLoading) {
        return SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: EdgeInsets.fromLTRB(
            NhamSpacing.sp3,
            0,
            NhamSpacing.sp3,
            _dockHeight,
          ),
          child: body,
        );
      }

      return SingleChildScrollView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            0,
            NhamSpacing.sp6,
            0,
            NhamSpacing.sp6 + _dockHeight,
          ),
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
        padding: EdgeInsets.fromLTRB(
          NhamSpacing.sp3,
          0,
          NhamSpacing.sp3,
          _dockHeight,
        ),
        itemCount: persistedMeals.length + (hasFooterItems ? 1 : 0),
        // The ONE gap between cards — no card carries a bottom margin of its
        // own, so this separator is the whole story.
        separatorBuilder:
            (_, __) => const SizedBox(height: LoggingSpacing.block),
        itemBuilder: (context, index) {
          if (index < persistedMeals.length) {
            final meal = persistedMeals[index];
            return FadeIn(
              key: ValueKey(meal.id),
              child:
                  meal.isCheat
                      ? CheatMealCard(
                        meal: meal,
                        onRemove: () => _removeMeal(meal),
                      )
                      : PersistedMealCard(
                        meal: meal,
                        isLast:
                            !hasFooterItems &&
                            index == persistedMeals.length - 1,
                        onRemove: () => _removeMeal(meal),
                        onUpdate:
                            ({required edits, required removeIds}) =>
                                updatePersistedMeal(
                                  context,
                                  ref,
                                  userId: widget.profile.userId,
                                  date: widget.date,
                                  mealId: meal.id,
                                  edits: edits,
                                  removeIds: removeIds,
                                ),
                        onLogAgain:
                            () => logMealAgain(
                              context,
                              ref,
                              userId: widget.profile.userId,
                              date: widget.date,
                              mealId: meal.id,
                            ),
                      ),
            );
          }
          return _Footer(
            pendingConfirmations: pendingConfirmations,
            isStreaming: isStreaming,
            isRevealing: isRevealing,
            isCheatRevealing: isCheatRevealing,
            stream: stream,
            streamingRawInput: _inFlightText,
            confirmPending: confirmPending,
            onConfirm: _confirm,
            onConfirmReveal: _confirmReveal,
            onConfirmCheat: _confirmCheatPending,
            onConfirmCheatReveal: _confirmCheatReveal,
            onClarifyCheat: _clarifyCheat,
            revealRawInput: _revealRawInput,
            failedText: failedText,
            failedRetryable: failedRetryable,
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
      // Saved — a success haptic + a top toast confirm the meal landed.
      HapticFeedback.mediumImpact();
      if (mounted) showTopToast(context, 'logging.feedArea.savedMeal'.tr());
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
    String analysisId,
    List<MealQuantityEdit> edits,
  ) async {
    // Confirm against the day the analysis was submitted on (the reveal is
    // date-guarded to that day), so the ORIGIN date's caches are updated.
    final originDate =
        ref.read(streamAnalysisProvider).loggedDate ?? widget.date;
    try {
      await ref
          .read(confirmMealProvider(widget.profile.userId).notifier)
          .confirm(
            analysisId: analysisId,
            mealId: _uuid.v4(),
            originDate: originDate,
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
      HapticFeedback.mediumImpact();
      if (mounted) showTopToast(context, 'logging.feedArea.savedMeal'.tr());
      _revealRawInput = null;
      // The attempt reached a confirmed save — retire its id.
      _attemptId = null;
      ref.read(streamAnalysisProvider.notifier).reset();
    } catch (_) {
      if (mounted) setState(() => _errorText = 'errors.internal'.tr());
    }
  }

  /// Confirm a server-loaded cheat pending card. The server recomputes
  /// nutrition from the staged spec + these levels — never client numbers.
  Future<void> _confirmCheatPending(
    String analysisId,
    CheatSliderLevels levels,
  ) async {
    try {
      await ref
          .read(confirmMealProvider(widget.profile.userId).notifier)
          .confirm(
            analysisId: analysisId,
            mealId: _uuid.v4(),
            originDate: widget.date,
            levels: cheatLevelsToWire(levels),
          );
      HapticFeedback.mediumImpact();
      if (mounted) showTopToast(context, 'logging.feedArea.savedMeal'.tr());
    } catch (_) {
      if (mounted) setState(() => _errorText = 'errors.internal'.tr());
    }
  }

  /// Confirm straight from the revealed cheat slider card (the analysis is
  /// already staged — analysis_complete arrived with the spec). Mirrors
  /// [_confirmReveal]: on success the stream resets so the card hands off to
  /// the refetched persisted cheat card.
  Future<void> _confirmCheatReveal(CheatSliderLevels levels) async {
    final stream = ref.read(streamAnalysisProvider);
    final analysisId = stream.analysisId;
    if (analysisId == null) return;
    final originDate = stream.loggedDate ?? widget.date;
    try {
      await ref
          .read(confirmMealProvider(widget.profile.userId).notifier)
          .confirm(
            analysisId: analysisId,
            mealId: _uuid.v4(),
            originDate: originDate,
            levels: cheatLevelsToWire(levels),
          );
      HapticFeedback.mediumImpact();
      if (mounted) showTopToast(context, 'logging.feedArea.savedMeal'.tr());
      _revealRawInput = null;
      // The attempt reached a confirmed save — retire its id.
      _attemptId = null;
      ref.read(streamAnalysisProvider.notifier).reset();
    } catch (_) {
      if (mounted) setState(() => _errorText = 'errors.internal'.tr());
    }
  }

  /// Vague-input fallback: re-run the cheat estimator with the chosen answer.
  /// Nothing was staged for the vague attempt, so this is a fresh analyze of
  /// the same occasion text plus `clarifyAnswer` (mirrors web
  /// `handleCheatClarify`).
  void _clarifyCheat(String answer) {
    final text = _revealRawInput;
    if (text == null || text.isEmpty) return;
    // Reuse this attempt's id — a vague cheat input stages nothing, but a
    // double-fired clarify would stage twice; the shared id collapses it to one.
    _attemptId ??= _uuid.v4();
    setState(() {
      _revealRawInput = null;
      _inFlightText = text;
    });
    _scrollToAnswer();
    ref
        .read(streamAnalysisProvider.notifier)
        .analyze(
          StreamAnalyzeInput(
            message: text,
            loggedDate: widget.date,
            timezoneOffset: timezoneOffsetMinutes(),
            mode: 'cheat',
            cheatIntensity: _cheatIntensity.name,
            clarifyAnswer: answer,
            attemptId: _attemptId,
          ),
        );
  }

  /// "Log it again": re-stage a past cheat occasion's sliders (seeded with
  /// last time's amounts) without re-running the estimator. The staged pending
  /// surfaces as a seeded slider card via the awaited day refresh.
  Future<void> _repeatCheat(RecentCheatOccasion occasion) async {
    if (_stagingRepeat) return;
    setState(() => _stagingRepeat = true);
    try {
      await stageCheatRepeat(
        ref,
        userId: widget.profile.userId,
        sourceMealId: occasion.mealId,
        date: widget.date,
      );
      _scrollToAnswer();
    } catch (_) {
      if (mounted) showTopToast(context, 'errors.internal'.tr());
    } finally {
      if (mounted) setState(() => _stagingRepeat = false);
    }
  }
}

/// The light/medium/heavy intensity picker shown above the composer in cheat
/// mode — a quiet label + the shared segmented strip.
class _CheatIntensityRow extends StatelessWidget {
  const _CheatIntensityRow({required this.value, required this.onChange});

  final CheatIntensity value;
  final ValueChanged<CheatIntensity> onChange;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('logging.cheatIntensity.label'.tr(), style: dashEyebrow()),
              const SizedBox(height: 2),
              Text('logging.cheatIntensity.helper'.tr(), style: dashMeta()),
            ],
          ),
        ),
        const SizedBox(width: NhamSpacing.sp3),
        SizedBox(
          width: 200,
          child: OptionStrip(
            value: value.name,
            options: [
              for (final intensity in CheatIntensity.values)
                OptionStripItem(
                  value: intensity.name,
                  label: 'logging.cheatIntensity.${intensity.name}'.tr(),
                ),
            ],
            onChange: (name) => onChange(CheatIntensity.values.byName(name)),
          ),
        ),
      ],
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer({
    required this.pendingConfirmations,
    required this.isStreaming,
    required this.isRevealing,
    required this.isCheatRevealing,
    required this.stream,
    required this.streamingRawInput,
    required this.confirmPending,
    required this.onConfirm,
    required this.onConfirmReveal,
    required this.onConfirmCheat,
    required this.onConfirmCheatReveal,
    required this.onClarifyCheat,
    required this.revealRawInput,
    required this.failedText,
    required this.failedRetryable,
    required this.onRetry,
    required this.onDiscardFailed,
  });

  final List<PendingMealConfirmation> pendingConfirmations;
  final bool isStreaming;
  final bool isRevealing;
  final bool isCheatRevealing;
  final String? revealRawInput;

  /// The just-typed text of the in-flight analysis, shown on the streaming card
  /// immediately so the card carries the user's words while it analyzes.
  final String? streamingRawInput;
  final StreamAnalysisState stream;
  final bool confirmPending;
  final void Function(String analysisId, List<MealQuantityEdit> edits)
  onConfirm;
  final void Function(String analysisId, List<MealQuantityEdit> edits)
  onConfirmReveal;
  final void Function(String analysisId, CheatSliderLevels levels)
  onConfirmCheat;
  final ValueChanged<CheatSliderLevels> onConfirmCheatReveal;
  final ValueChanged<String> onClarifyCheat;
  final String? failedText;
  final bool failedRetryable;
  final VoidCallback onRetry;
  final VoidCallback onDiscardFailed;

  @override
  Widget build(BuildContext context) {
    final hasFailed = failedText != null;
    // The footer's cards carry no margins of their own, so the stack spaces
    // them at the same block gap the card list uses above.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: LoggingSpacing.block,
      children: [
        for (var i = 0; i < pendingConfirmations.length; i++)
          if (pendingConfirmations[i].cheatSpec case final cheatSpec?)
            CheatSliderCard(
              key: ValueKey(pendingConfirmations[i].id),
              spec: cheatSpec,
              rawInput: pendingConfirmations[i].rawInput,
              busy: confirmPending,
              onConfirm:
                  (levels) =>
                      onConfirmCheat(pendingConfirmations[i].id, levels),
            )
          else if (pendingConfirmations[i].parsedMeal case final parsedMeal?)
            MealEntry(
              key: ValueKey(pendingConfirmations[i].id),
              rawInput: pendingConfirmations[i].rawInput,
              parsedMeal: parsedMeal,
              busy: confirmPending,
              isLast:
                  !isStreaming &&
                  !isRevealing &&
                  !isCheatRevealing &&
                  !hasFailed &&
                  i == pendingConfirmations.length - 1,
              onConfirm:
                  (edits) => onConfirm(pendingConfirmations[i].id, edits),
            ),
        if (isStreaming)
          StreamingEntry(
            status: stream.status,
            items: stream.items,
            completedItems: stream.completedItems,
            rawInput: streamingRawInput,
            isLast: !hasFailed,
          ),
        // The completed answer in the streaming card's slot: per-row macros
        // already real, totals count up, the spinner row swapped for
        // Edit/Confirm. This IS a remount (StreamingEntry and MealEntry are
        // different widgets) — the `revealing` flag softens the seam: the card
        // background matches the streaming card's and the item rows crossfade
        // in place instead of re-entering.
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
        // The cheat reveal: an interactive slider card when the estimate is
        // staged (analysisId set), or the clarifying-question card when the
        // input was too vague (no analysisId — answering re-runs the
        // estimator).
        if (isCheatRevealing)
          CheatSliderCard(
            key: ValueKey('cheat-reveal-${stream.analysisId ?? 'clarify'}'),
            spec: stream.cheatSpec!,
            rawInput: revealRawInput ?? '',
            busy: confirmPending,
            onConfirm: onConfirmCheatReveal,
            onClarify: onClarifyCheat,
          ),
        if (hasFailed)
          FailedAttemptCard(
            rawInput: failedText!,
            retryable: failedRetryable,
            onRetry: onRetry,
            onDiscard: onDiscardFailed,
          ),
      ],
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
        color: NhamColors.elev,
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
            'logging.feedArea.partialDayNotice.body'.tr(
              namedArgs: {
                'calories': formatCount(calories, locale),
                'target': formatCount(target, locale),
              },
            ),
            variant: NhamTextVariant.small,
            style: dashMeta(),
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
          width: 76,
          child: NhamText(
            data.label,
            variant: NhamTextVariant.macroLabel,
            maxLines: 1,
            softWrap: false,
            overflow: TextOverflow.clip,
            style: dashEyebrow(),
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
    // Reduced motion: render the fill at its resting width, no sweep.
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
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
                widthFactor: ((reduceMotion ? widget.pct : _anim.value) / 100)
                    .clamp(0, 1),
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
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Reduced motion: hold the skeleton fully visible instead of looping.
    if (MediaQuery.disableAnimationsOf(context)) {
      _c
        ..stop()
        ..value = 1;
    } else if (!_c.isAnimating) {
      _c.repeat(reverse: true);
    }
  }

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
          _bar(_labelWidths[i], 12, const Color(0xB3E8E6DC)), // border/70
          const SizedBox(height: NhamSpacing.sp2), // mb-2
          _bar(64, 20, NhamColors.track), // h-5 w-16 track skeleton pill
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

/// Day-loading skeleton: 2 pulsing full-width ghost cards, each with a time
/// bar, a title bar, 3 text lines, and a hairline-topped totals row
/// (LoggingDaySkeleton).
class _LoggingDaySkeleton extends StatelessWidget {
  const _LoggingDaySkeleton();

  @override
  Widget build(BuildContext context) {
    Widget ghostCard(bool isLast) => Padding(
      padding: const EdgeInsets.only(bottom: LoggingSpacing.block),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _bar(64, 12, const Color(0xB3E8E6DC)), // border/70 time bar
          const SizedBox(height: NhamSpacing.sp2), // mb-2
          Container(
            padding: const EdgeInsets.all(NhamSpacing.sp4), // p-5→16
            decoration: BoxDecoration(
              color: const Color(0x33F0EAE0), // bg-nham-hover/20
              borderRadius: BorderRadius.circular(NhamRadii.containerLg), // 2xl
              border: Border.all(color: NhamColors.borderSoft), // /60
              boxShadow: const [NhamShadows.sm],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                LayoutBuilder(
                  builder:
                      (_, c) =>
                          _bar(c.maxWidth * 2 / 3, 20, const Color(0xB3E8E6DC)),
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
                const SizedBox(height: LoggingSpacing.section),
                const Divider(
                  height: 1,
                  thickness: 1,
                  color: NhamColors.borderHalf,
                ),
                const SizedBox(height: LoggingSpacing.section),
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
    );

    return _Pulse(child: Column(children: [ghostCard(false), ghostCard(true)]));
  }
}
