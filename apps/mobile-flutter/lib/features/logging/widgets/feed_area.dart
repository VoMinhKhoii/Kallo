import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../models/cheat.dart';
import '../data/logging_models.dart';
import '../data/logging_providers.dart';
import '../data/stream_analysis_controller.dart';
import '../logic/feed/analysis_actions.dart';
import '../logic/feed/confirm_actions.dart';
import '../logic/feed/meal_actions.dart';
import '../logic/feed/view_state.dart';
import 'feed/composer_actions.dart';
import 'feed/feed_composer.dart';
import 'feed/feed_footer.dart';
import 'feed/feed_list.dart';
import 'feed/macro_summary.dart';
import 'meal_input.dart';
import 'sheets/meal_mode_sheet.dart';

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

  /// The day whose under-logged note has been dismissed. Keyed by date, not a
  /// bare bool: the condition is still true after dismissal — the user has
  /// simply read it — so paging to another day shows that day's note again.
  String? _noticeDismissedFor;

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
    refreshRevealedAnalysisDay(
      ref,
      userId: widget.profile.userId,
      fallbackDate: widget.date,
    );
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
    startMealAnalysis(
      ref,
      message: text,
      date: widget.date,
      isCheat: _mode == MealLogMode.cheat,
      cheatIntensity: _cheatIntensity,
      attemptId: _attemptId,
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

  /// Normal and Cheat are the persistent modes — selecting one keeps the
  /// composer in it and puts the cursor straight back in the field.
  void _setMode(MealLogMode mode) {
    setState(() => _mode = mode);
    _inputController.focus();
  }

  Future<void> _openModeSheet() => chooseLogMode(
    context,
    current: _mode,
    userId: widget.profile.userId,
    date: widget.date,
    onPersistentMode: _setMode,
    onBarcode: _openBarcodeSheet,
  );

  Future<void> _openBarcodeSheet() => openBarcodeLogSheet(
    context,
    userId: widget.profile.userId,
    date: widget.date,
    onFallbackToText: () => _inputController.focus(),
  );

  /// The revealed answer landed: it becomes the confirmable card, carrying the
  /// user's own words across.
  void _revealAnswer() {
    _revealRawInput = _inFlightText;
    _inFlightText = null;
    HapticFeedback.lightImpact();
    _scrollToAnswer();
  }

  void _failAttempt(bool retryable) {
    final text = _inFlightText;
    setState(() {
      _failedText = text;
      _failedRetryable = retryable;
      _inFlightText = null;
    });
    if (text != null && _inputController.getText().trim().isEmpty) {
      _inputController.setText(text);
    }
    ref.read(streamAnalysisProvider.notifier).reset();
  }

  /// An action failed: surface it as the composer's inline error line.
  void _showActionError() =>
      setState(() => _errorText = 'errors.internal'.tr());

  /// A REVEALED answer was saved: drop its raw text, retire the attempt id and
  /// tear the local stream down so the revealed card hands off to the refetched
  /// persisted card.
  void _onRevealSaved() {
    _revealRawInput = null;
    // The attempt reached a confirmed save — retire its id.
    _attemptId = null;
    ref.read(streamAnalysisProvider.notifier).reset();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<StreamAnalysisState>(
      streamAnalysisProvider,
      (prev, next) => onStreamTransition(
        prev,
        next,
        onRevealed: _revealAnswer,
        onFailed: _failAttempt,
      ),
    );

    final profile = widget.profile;
    final stream = ref.watch(streamAnalysisProvider);
    final dayAsync = ref.watch(loggingDayProvider(_dayArgs));
    final confirmPending = ref.watch(confirmMealProvider(profile.userId));

    final view = FeedViewState.from(
      day: dayAsync.valueOrNull,
      dayIsLoading: dayAsync.isLoading,
      dayHasError: dayAsync.hasError,
      stream: stream,
      profile: profile,
      date: widget.date,
      pendingRemovalIds: _pendingRemovalIds,
      hasFailedAttempt: _failedText != null,
    );

    final confirmActions = FeedConfirmActions(
      context: context,
      ref: ref,
      userId: profile.userId,
      date: widget.date,
      onError: _showActionError,
      onRevealSaved: _onRevealSaved,
    );

    final mealActions = FeedMealActions(
      context: context,
      ref: ref,
      userId: profile.userId,
      date: widget.date,
      onHoldRemoval: (id) => setState(() => _pendingRemovalIds.add(id)),
      onReleaseRemoval: (id) => setState(() => _pendingRemovalIds.remove(id)),
      onRemovalFailed:
          (id) => setState(() {
            _pendingRemovalIds.remove(id);
            _errorText = 'errors.internal'.tr();
          }),
    );

    final footer = FeedFooter(
      view: view,
      stream: stream,
      streamingRawInput: _inFlightText,
      confirmPending: confirmPending,
      onConfirm: confirmActions.confirmPending,
      onConfirmReveal: confirmActions.confirmReveal,
      onConfirmCheat: confirmActions.confirmCheatPending,
      onConfirmCheatReveal: confirmActions.confirmCheatReveal,
      onClarifyCheat: _clarifyCheat,
      revealRawInput: _revealRawInput,
      failedText: _failedText,
      failedRetryable: _failedRetryable,
      onRetry: _retry,
      onDiscardFailed: _discardFailed,
    );

    return Column(
      children: [
        MacroSummary(view: view, profile: profile),

        // The card list, with the composer FLOATING over its bottom edge —
        // the feed scrolls under the dock (reserving `_dockHeight` so the last
        // card can always clear it) instead of stopping above a solid bar.
        Expanded(
          child: Stack(
            children: [
              Positioned.fill(
                child: FeedList(
                  view: view,
                  dockHeight: _dockHeight,
                  scrollController: _scrollController,
                  footer: footer,
                  onRefresh: mealActions.refreshDay,
                  onRetryDay:
                      () => ref.invalidate(loggingDayProvider(_dayArgs)),
                  onRemoveMeal: mealActions.remove,
                  onUpdateMeal: mealActions.update,
                  onLogAgain: mealActions.logAgain,
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: FeedComposer(
                  view: view,
                  calorieTarget: profile.calorieTarget,
                  errorText: _errorText,
                  mode: _mode,
                  cheatIntensity: _cheatIntensity,
                  onCheatIntensityChange:
                      (intensity) =>
                          setState(() => _cheatIntensity = intensity),
                  userId: widget.profile.userId,
                  stagingRepeat: _stagingRepeat,
                  onRepeatCheat: _repeatCheat,
                  controller: _inputController,
                  onSubmit: _submit,
                  onCancel:
                      () =>
                          ref.read(streamAnalysisProvider.notifier).cancel(),
                  analyzing: stream.isAnalyzing,
                  onModePressed: _openModeSheet,
                  onBarcodePressed: _openBarcodeSheet,
                  noticeDismissed: _noticeDismissedFor == widget.date,
                  onDismissNotice:
                      () => setState(() => _noticeDismissedFor = widget.date),
                  onHeightChanged:
                      (height) => setState(() => _dockHeight = height),
                ),
              ),
            ],
          ),
        ),
      ],
    );
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
    startMealAnalysis(
      ref,
      message: text,
      date: widget.date,
      isCheat: true,
      cheatIntensity: _cheatIntensity,
      clarifyAnswer: answer,
      attemptId: _attemptId,
    );
  }

  /// "Log it again" — one re-stage at a time; the chips are disabled while it
  /// runs, and this guard covers a double tap that beats the rebuild.
  Future<void> _repeatCheat(RecentCheatOccasion occasion) async {
    if (_stagingRepeat) return;
    await repeatCheatOccasion(
      context,
      ref,
      occasion: occasion,
      userId: widget.profile.userId,
      date: widget.date,
      onStaged: _scrollToAnswer,
      onStagingChange: (staging) => setState(() => _stagingRepeat = staging),
    );
  }
}
