import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/surface/scroll_separator.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../../models/logging/relog.dart';
import '../../data/logging_models.dart';
import '../../data/logging_providers.dart';
import '../../data/logging_ui_state.dart';
import '../../data/stream_analysis_controller.dart';
import '../../logic/feed/analysis_actions.dart';
import '../../logic/feed/analysis_run.dart';
import '../../logic/feed/cheat_actions.dart';
import '../../logic/feed/confirm_actions.dart';
import '../../logic/feed/meal_actions.dart';
import '../../logic/feed/pending_meal_handoff.dart';
import '../../logic/feed/view_state.dart';
import '../../logic/meal_log_mode.dart';
import '../../logic/relog/composer_submit.dart';
import '../../logic/relog/relog_picker_controller.dart';
import '../composer/feed_composer.dart';
import '../composer/meal_input.dart';
import '../relog/mention_text_controller.dart';
import '../sheets/feed_sheets.dart';
import 'feed_footer.dart';
import 'feed_list.dart';
import 'feed_scroll_pin.dart';
import 'summary/macro_summary.dart';

/// The day's meal feed: macro summary header, the scrollable card list, the
/// pending/streaming footer, and the natural-language meal input.
///
/// Ported 1:1 from web `components/logging/feed/feed-area.tsx`.
class FeedArea extends ConsumerStatefulWidget {
  const FeedArea({super.key, required this.profile, required this.date});

  final LoggingProfile profile;
  final String date;

  @override
  ConsumerState<FeedArea> createState() => _FeedAreaState();
}

class _FeedAreaState extends ConsumerState<FeedArea> {
  final MealInputController _inputController = MealInputController();

  /// The composer's text AND relog picks — owned by
  /// [composerControllerProvider], never disposed here: Log is a fresh push
  /// per visit, and a State-owned controller dropped the draft on every pop.
  late final MentionTextEditingController _textController =
      ref.read(composerControllerProvider);

  /// The `/` picker: whether it is open, on which token, and the debounced
  /// query behind it.
  late final RelogPickerController _picker = RelogPickerController(
    composer: _textController,
    onChanged: _rebuild,
  );

  /// The analysis on screen: what is in flight, what failed, and what has been
  /// revealed but not yet confirmed.
  late final FeedAnalysisRun _analysis = FeedAnalysisRun(
    composer: _textController,
    input: _inputController,
    onChanged: _rebuild,
    onScrollToAnswer: () => _pin.pinToBottom(widget.date),
  );

  /// Which of the three shapes a submit is, and running it.
  late final ComposerSubmitter _submitter = ComposerSubmitter(
    composer: _textController,
    run: _analysis,
    onChanged: _rebuild,
    onStaged: () => _pin.pinToBottom(widget.date),
  );

  /// True while a "log it again" occasion is being re-staged server-side.
  bool _stagingRepeat = false;

  /// Scrolls the freshly-revealed answer into view (nothing scrolled it before).
  final ScrollController _scrollController = ScrollController();

  /// Keeps the tail in view while the answer lands. See [FeedScrollPin] — a
  /// single post-frame scroll aimed at a `maxScrollExtent` that the streaming
  /// card and the keyboard inset were both still changing, so it stopped short.
  final FeedScrollPinHandle _pin = FeedScrollPinHandle();

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

  /// A meal parked by an off-feed composer, claimed exactly once.
  final PendingMealHandoff _handoff = PendingMealHandoff();

  LoggingDayArgs get _dayArgs =>
      LoggingDayArgs(widget.profile.userId, widget.date);

  /// What the controllers above call when something they own changed.
  void _rebuild() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _picker.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  /// Relog is normal-mode only — manual and cheat own the composer's slots
  /// themselves, and the server rejects a cheat submission carrying picks.
  void _onComposerSync() => _picker.sync(
    enabled: ref.read(mealLogModeProvider) == MealLogMode.normal,
  );

  void _selectRelogCandidate(RelogCandidate candidate) {
    if (_picker.select(candidate) || !mounted) return;
    showTopToast(
      context,
      'logging.relog.stagedFull'.tr(namedArgs: {'max': '$kRelogMaxStaged'}),
    );
  }

  void _submitComposer(String text) => _submitter.submit(
    context,
    ref,
    userId: widget.profile.userId,
    date: widget.date,
    text: text,
  );

  /// Run the parked meal exactly as if it had been typed into the composer
  /// below. Deferred past the frame that spotted it — it writes provider state
  /// and calls `setState`, neither legal during a build.
  void _consumePendingMeal() {
    if (!mounted) return;
    final meal = _handoff.take(ref);
    if (meal == null) return;
    _analysis.startPlain(
      ref,
      userId: widget.profile.userId,
      date: widget.date,
      text: meal,
    );
  }

  /// An action failed: surface it as the composer's inline error line.
  void _showActionError() =>
      setState(() => _errorText = 'errors.internal'.tr());

  @override
  Widget build(BuildContext context) {
    final profile = widget.profile;

    listenToAnalysisStream(
      ref,
      onRevealed:
          () =>
              _analysis.reveal(ref, userId: profile.userId, date: widget.date),
      onFailed:
          (retryable, paymentRequired) => _analysis.fail(
            context,
            ref,
            retryable: retryable,
            paymentRequired: paymentRequired,
          ),
    );

    _handoff.claim(
      ref,
      () => WidgetsBinding.instance.addPostFrameCallback(
        (_) => _consumePendingMeal(),
      ),
    );

    final mode = ref.watch(mealLogModeProvider);
    final cheatIntensity = ref.watch(cheatIntensityProvider);
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
      hasFailedAttempt: _analysis.failedText != null,
    );

    final confirmActions = FeedConfirmActions(
      context: context,
      ref: ref,
      userId: profile.userId,
      date: widget.date,
      onError: _showActionError,
      onRevealSaved: () => _analysis.revealSaved(ref),
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

    final cheatActions = FeedCheatActions(
      context: context,
      ref: ref,
      userId: profile.userId,
      date: widget.date,
      run: _analysis,
      input: _inputController,
      isStaging: () => _stagingRepeat,
      onStagingChange: (staging) => setState(() => _stagingRepeat = staging),
      onStaged: () => _pin.pinToBottom(widget.date),
    );

    final sheets = FeedSheets(
      context: context,
      userId: profile.userId,
      date: widget.date,
      mode: mode,
      onPersistentMode: cheatActions.setMode,
      onFallbackToText: _inputController.focus,
    );

    final footer = FeedFooter(
      view: view,
      stream: stream,
      streamingRawInput: _analysis.inFlightLabel,
      loaderIndex: _analysis.loaderIndex,
      sentAt: _analysis.sentAt,
      confirmPending: confirmPending,
      onConfirmReveal: confirmActions.confirmReveal,
      onConfirmCheatReveal: confirmActions.confirmCheatReveal,
      onClarifyCheat: cheatActions.clarify,
      revealRawInput: _analysis.revealRawInput,
      failedText: _analysis.failedText,
      failedRetryable: _analysis.failedRetryable,
      onRetry:
          () => _analysis.retry(ref, userId: profile.userId, date: widget.date),
      onDiscardFailed: _analysis.discardFailed,
    );

    // The hairline anchors under the macro summary, not under the date strip
    // above it: the summary does not scroll, so a rule any higher would claim
    // content had passed beneath it when it had not.
    return ScrollSeparator(
      header: MacroSummary(view: view, profile: profile),

      overlay: Positioned(
        left: 0,
        right: 0,
        bottom: 0,
        child: FeedComposer(
          view: view,
          calorieTarget: profile.calorieTarget,
          errorText: _errorText,
          mode: mode,
          cheatIntensity: cheatIntensity,
          userId: profile.userId,
          stagingRepeat: _stagingRepeat,
          onRepeatCheat: cheatActions.repeat,
          controller: _inputController,
          textController: _textController,
          onSync: _onComposerSync,
          relogQuery: _picker.query,
          onSelectRelog: _selectRelogCandidate,
          onDismissRelog: _picker.dismiss,
          onSubmit: _submitComposer,
          onCancel: () => ref.read(streamAnalysisProvider.notifier).cancel(),
          analyzing: stream.isAnalyzing,
          onModePressed: sheets.openMode,
          onBarcodePressed: sheets.openBarcode,
          noticeDismissed: _noticeDismissedFor == widget.date,
          onDismissNotice:
              () => setState(() => _noticeDismissedFor = widget.date),
          onHeightChanged: (height) => setState(() => _dockHeight = height),
        ),
      ),
      // The card list. The composer floats over its bottom edge as an
      // `overlay`, NOT as a child — it owns a multiline field whose own
      // vertical Scrollable would otherwise reach the hairline listener as a
      // depth-0 sibling and raise the rule while the feed sat at the top.
      child: FeedList(
        view: view,
        dockHeight: _dockHeight,
        scrollController: _scrollController,
        pin: _pin,
        footer: footer,
        confirmPending: confirmPending,
        onRefresh: mealActions.refreshDay,
        onRetryDay: () => ref.invalidate(loggingDayProvider(_dayArgs)),
        onRemoveMeal: mealActions.remove,
        onDiscardPending: mealActions.discardPending,
        onUpdateMeal: mealActions.update,
        onLogAgain: mealActions.logAgain,
        onConfirm: confirmActions.confirmPending,
        onConfirmCheat: confirmActions.confirmCheatPending,
      ),
    );
  }
}
