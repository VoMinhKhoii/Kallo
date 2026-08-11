import 'dart:async' show Timer, unawaited;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';

import '../../../shared/widgets/scroll_separator.dart';
import '../../../shared/widgets/top_toast.dart';
import '../../../models/cheat.dart';
import '../../../models/relog.dart';
import '../data/logging_models.dart';
import '../data/logging_providers.dart';
import '../data/relog_providers.dart';
import '../data/stream_analysis_controller.dart';
import '../logic/feed/analysis_actions.dart';
import '../logic/feed/confirm_actions.dart';
import '../logic/feed/meal_actions.dart';
import '../logic/feed/view_state.dart';
import '../logic/meal_log_mode.dart';
import '../logic/relog/composer_submit_plan.dart';
import '../logic/relog/mentions.dart' show MentionSnapshot;
import '../logic/relog/relog_label.dart';
import '../logic/relog/slash_picker_state.dart';
import 'feed/composer_actions.dart';
import 'feed/feed_composer.dart';
import 'feed/feed_footer.dart';
import 'feed/feed_list.dart';
import 'feed/macro_summary.dart';
import 'loaders/loader_registry.dart';
import 'meal_input.dart';
import 'relog/mention_text_controller.dart';
import 'sheets/manual_log_sheet.dart';

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

  /// The composer's text AND the relog picks living inside it as tinted runs.
  /// Owned here, not by [MealInput], because the submit path reads the picks
  /// and the free text around them.
  final MentionTextEditingController _textController =
      MentionTextEditingController();

  /// Whether the `/` picker is open, and on which token. Relog is normal-mode
  /// only — manual and cheat own the composer's slots themselves, and the
  /// server rejects a cheat submission carrying picks.
  SlashPickerState _picker = const SlashPickerState();

  /// The DEBOUNCED query behind [_picker] — what the search actually asks for.
  /// Null whenever the picker is closed.
  String? _relogQuery;
  Timer? _relogDebounce;

  /// True while a pure-relog submit is staging server-side; guards the double
  /// tap that beats the rebuild.
  bool _stagingRelog = false;

  /// Attempt ids for pure-relog submits, keyed by the selection they staged.
  ///
  /// Retrying the same picks must reuse its id so the server's
  /// `(user_id, attempt_id)` upsert overwrites the row it already wrote. Without
  /// that, a stage that commits but loses its response — the composer is left
  /// untouched, so the user resubmits — writes a SECOND pending row, and one
  /// meal arrives as two cards to confirm.
  ///
  /// An entry is dropped once its stage is known to have landed. Changing the
  /// picks changes the key, which is what mints a new id for a new meal.
  final Map<String, String> _pureRelogAttempts = {};

  static String _selectionKey(Set<String> stageIds) =>
      (stageIds.toList()..sort()).join('|');

  String _attemptIdForSelection(Set<String> stageIds) =>
      _pureRelogAttempts.putIfAbsent(_selectionKey(stageIds), _uuid.v4);

  /// The composer as it stood when a COMBINED submit (free text + picks) went
  /// out. That submit sends the free text alone and clears the field, so on any
  /// failure the picks must come back intact for a retry rather than vanishing
  /// behind a submit that produced no confirmable card.
  MentionSnapshot? _relogSnapshot;

  /// True while a "log it again" occasion is being re-staged server-side.
  bool _stagingRepeat = false;

  /// Scrolls the freshly-revealed answer into view (nothing scrolled it before).
  final ScrollController _scrollController = ScrollController();

  /// The text of the run currently in flight — restored to the composer if it
  /// fails, so a failed analysis never destroys what the user typed.
  ///
  /// This is the STRIPPED free text on a combined submit: the picks were pulled
  /// out of it before the AI saw them. Use [_inFlightLabel] for anything the
  /// user reads.
  String? _inFlightText;

  /// The relogged picks riding along with [_inFlightText], by display name.
  /// Empty for a plain submit.
  List<String> _inFlightPicks = const [];

  /// The references actually SENT with [_inFlightText], and whether it went out
  /// as a cheat estimate. Frozen here because a retry must replay the attempt
  /// that failed — not re-derive one from a composer the user has edited since,
  /// nor from a mode they have switched in the meantime.
  List<RelogRef> _inFlightRefs = const [];
  bool _inFlightCheat = false;

  /// What the in-flight run's card should SAY: the user's OWN sentence with the
  /// `/` markers taken off.
  ///
  /// Not a reconstruction. Joining `[freeText, ...pickNames]` — which is how
  /// the server derives `meals.raw_input` — reorders the sentence whenever a
  /// pick did not come last: typing "/1 cơm gà… + 1 kem vani" came back as
  /// "+ 1 kem vani, 1 cơm gà…", with the typed remainder hoisted in front of
  /// the dish it followed. The card is the user reading their own words back,
  /// so it shows them in the order they wrote them.
  ///
  /// The persisted card, once confirmed, still carries the server's joined
  /// form. That divergence is deliberate: the alternative is a card that reads
  /// scrambled for the whole time the analysis is on screen.
  String? _inFlightLabelText;

  String? get _inFlightLabel => _inFlightLabelText ?? _inFlightText;

  /// Which of the twelve loaders this run draws. Rolled once per submit and
  /// held for the whole run — a loader that changed mid-analysis would read as
  /// a restart. Lives HERE, not in the streaming widget, so a rebuild of the
  /// footer (a pending card arriving, say) cannot re-roll it.
  int _loaderIndex = 0;

  /// A failed attempt, rendered as a feed card with "Try again" (terracotta).
  String? _failedText;

  /// The failed attempt's own references, pick names and mode — the exact shape
  /// that went out. "Try again" replays THIS, so a retry can never attach picks
  /// the attempt never carried, or resubmit a cheat estimate as a normal
  /// analysis because the user changed mode while the error card sat there.
  List<RelogRef> _failedRefs = const [];
  List<String> _failedPicks = const [];
  String? _failedLabel;
  bool _failedCheat = false;

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

  /// True from the moment a build sees a meal parked in [pendingMealProvider]
  /// until that meal has been taken out of the provider. It exists to make the
  /// hand-off fire EXACTLY once: `build` can run many times (and does — the
  /// post-frame gap alone can contain several) while the slot still holds the
  /// same text, and every one of those builds would otherwise schedule its own
  /// run of the analysis.
  bool _claimedPendingMeal = false;

  LoggingDayArgs get _dayArgs =>
      LoggingDayArgs(widget.profile.userId, widget.date);

  @override
  void dispose() {
    _relogDebounce?.cancel();
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  // ── Relog: the `/` picker ────────────────────────────────────────────────

  /// One handler for every "the value or the caret may have moved" signal.
  ///
  /// The mentions have already been re-located by the controller; this decides
  /// whether a `/` token is open at the caret and, if so, what to search for.
  void _onComposerSync() {
    final enabled = ref.read(mealLogModeProvider) == MealLogMode.normal;
    final next = _picker.sync(enabled ? _textController.activeToken : null);
    if (next == _picker) return;
    final queryChanged = next.query != _picker.query;
    setState(() => _picker = next);
    if (queryChanged) _scheduleRelogQuery(next.query);
  }

  /// Debounce the search so typing a dish name is one request, not eight.
  /// Opening the picker (`/` with nothing after it) resolves immediately —
  /// that list is the user's staples and is almost always already cached.
  void _scheduleRelogQuery(String? query) {
    _relogDebounce?.cancel();
    if (query == null) {
      if (_relogQuery != null) setState(() => _relogQuery = null);
      return;
    }
    final trimmed = query.trim();
    if (SlashPickerState.resolvesImmediately(_relogQuery, trimmed)) {
      setState(() => _relogQuery = trimmed);
      return;
    }
    _relogDebounce = Timer(const Duration(milliseconds: 300), () {
      if (mounted) setState(() => _relogQuery = trimmed);
    });
  }

  void _closeRelogPicker(SlashPickerState next) {
    _relogDebounce?.cancel();
    setState(() {
      _picker = next;
      _relogQuery = null;
    });
  }

  /// Commit a pick: its label is written into the composer as a tinted run and
  /// its reference is staged.
  void _selectRelogCandidate(RelogCandidate candidate) {
    final token = _picker.token;
    if (token == null) return;
    final added = _textController.addMention(candidate, token, _uuid.v4());
    if (!added && mounted) {
      showTopToast(
        context,
        'logging.relog.stagedFull'.tr(namedArgs: {'max': '$kRelogMaxStaged'}),
      );
    }
    // close(), not dismiss(): a pick is not a refusal, so the next `/` — even
    // one landing at the same offset — must open normally.
    _closeRelogPicker(_picker.close());
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

  /// Take the meal parked by an off-feed composer (the dashboard's quick-log
  /// sheet, a first-run suggestion chip) and run it exactly as if it had been
  /// typed into the composer below.
  ///
  /// Called from a post-frame callback because it writes provider state and
  /// calls `setState` — neither is legal during the build that spotted it.
  void _consumePendingMeal() {
    if (!mounted) return;
    final text = ref.read(pendingMealProvider);
    // Empty the slot BEFORE releasing the claim: for the whole window in which
    // a rebuild could observe a value, the claim is still held, so no second
    // run can be scheduled. Once both have happened the pair is back to
    // (null, unclaimed) — ready for the next hand-off, and inert against a hot
    // reload or a tab switch, which re-run `build` but never refill the slot.
    ref.read(pendingMealProvider.notifier).state = null;
    _claimedPendingMeal = false;
    final meal = text?.trim() ?? '';
    if (meal.isEmpty) return;
    _submitPlain(meal);
  }

  /// Analyze a meal that did NOT come from this composer — the dashboard's
  /// quick-log sheet, a first-run suggestion chip. It carries no relog picks by
  /// construction, so it bypasses the unified submit entirely.
  void _submitPlain(String text) {
    // A fresh logging attempt: mint a new attempt id. Retries and cheat-clarify
    // resubmits reuse the existing id instead (see _retry / _clarifyCheat) so
    // the server upserts one staging row per attempt.
    _attemptId = _uuid.v4();
    _runAnalyze(text);
  }

  /// The composer's unified submit. One handler covers all three shapes, so a
  /// single submit always produces exactly one review card:
  ///
  ///  - text only, no picks      → the ordinary AI analysis.
  ///  - picks only, no free text → stage a deterministic relog analysis and
  ///                               surface its review card (no AI, no spend).
  ///  - free text AND picks      → analyze the text alone and send the picks as
  ///                               `refs`; the server merges the copied dishes
  ///                               in, so relogged items are never re-analyzed.
  void _submitComposer(String text) {
    final plan = planComposerSubmit(
      isNormal: ref.read(mealLogModeProvider) == MealLogMode.normal,
      staged: _textController.entries,
      text: text,
      freeText: _textController.freeText,
    );
    switch (plan) {
      case PlainAnalysis(:final text):
        _submitPlain(text);
      case PureRelog(:final refs, :final stageIds):
        if (_stagingRelog) return;
        unawaited(_submitPureRelog(refs, stageIds));
      case CombinedAnalysis(:final freeText, :final refs, :final pickNames):
        _attemptId = _uuid.v4();
        // _runAnalyze clears the composer to show the streaming card, which
        // drops the mentions with it — snapshot first so a failed run can hand
        // them back.
        _relogSnapshot = _textController.snapshot();
        // The label is taken BEFORE the composer is cleared: it is the sentence
        // on screen with the `/` markers removed, so the card reads back what
        // was typed, in that order.
        _runAnalyze(
          freeText,
          refs: refs,
          pickNames: pickNames,
          label: unmarkPicks(_textController.text, _textController.entries),
        );
    }
  }

  /// Pure relog: stage a deterministic analysis and let the day refetch surface
  /// its review card. Nothing is written to the day until the user confirms it,
  /// exactly as with an AI meal.
  Future<void> _submitPureRelog(List<RelogRef> refs, List<String> ids) async {
    setState(() => _stagingRelog = true);
    final selection = ids.toSet();
    try {
      await stageRelogAnalysis(
        ref,
        userId: widget.profile.userId,
        date: widget.date,
        items: refs,
        // Never the feed's `_attemptId`: the server upserts pending analyses on
        // (user_id, attempt_id), so borrowing the id of a revealed-but-
        // unconfirmed AI card would overwrite that card's row with this relog.
        //
        // Stable across retries of the SAME picks, though. A stage that commits
        // but whose response is lost leaves the composer untouched, so the user
        // resubmits — and a fresh id there would upsert a SECOND pending row,
        // giving one meal two review cards to confirm. Keyed on the selection,
        // so changing the picks does mint a new one.
        attemptId: _attemptIdForSelection(selection),
      );
      // Only what was actually SUBMITTED, and only after staging lands. The
      // field stays editable throughout, so a pick made while the POST was in
      // flight is not ours to clear — it was never sent.
      _textController.consumeMentions(selection);
      _pureRelogAttempts.remove(_selectionKey(selection));
      // `_attemptId` is deliberately untouched: it belongs to whatever AI
      // attempt is on screen, and a relog is a separate card.
      _scrollToAnswer();
    } catch (_) {
      if (mounted) showTopToast(context, 'errors.internal'.tr());
    } finally {
      if (mounted) setState(() => _stagingRelog = false);
    }
  }

  /// Core analyze path shared by fresh submit and retry. Honors the persistent
  /// composer mode (precise vs cheat) — whichever surface last set it, the feed
  /// composer or the dashboard's quick-log sheet — and sends the current
  /// [_attemptId].
  void _runAnalyze(
    String text, {
    List<RelogRef>? refs,
    List<String> pickNames = const [],
    bool? isCheat,
    String? label,
  }) {
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
      _inFlightLabelText = label;
      _inFlightPicks = pickNames;
      _inFlightRefs = refs ?? const [];
      // Resolved ONCE, here, and carried with the attempt. Reading it again at
      // retry time would let a mode switch turn a failed cheat estimate into a
      // normal analysis.
      _inFlightCheat =
          isCheat ?? ref.read(mealLogModeProvider) == MealLogMode.cheat;
      _loaderIndex = pickLoaderIndex();
    });
    _inputController.clear();
    _scrollToAnswer();
    startMealAnalysis(
      ref,
      message: text,
      date: widget.date,
      isCheat: _inFlightCheat,
      cheatIntensity: ref.read(cheatIntensityProvider),
      attemptId: _attemptId,
      refs: refs,
    );
  }

  void _retry() {
    final text = _failedText;
    if (text == null) return;
    // Reuse the failed attempt's id so the retry supersedes its staging row
    // (kept on error precisely for this). Fall back to a fresh id defensively.
    _attemptId ??= _uuid.v4();

    // REPLAY the failed attempt — text, references and mode exactly as they
    // went out — rather than re-planning from the live composer.
    //
    // Re-planning read `_textController.entries` and the current mode against
    // a `_failedText` frozen at the moment of failure, and those two drift: the
    // composer stays editable while the error card sits there, and picks
    // survive a mode switch. A cheat submit that failed could come back as a
    // normal analysis carrying leftover picks the user never sent with it —
    // and since a cheat message is the RAW composer text, its `/Phở bò` would
    // reach the AI as prose while the ref copied the same dish again.
    if (_failedRefs.isNotEmpty) {
      // _runAnalyze clears the composer again, so re-snapshot: a second failure
      // would otherwise have nothing to hand back.
      _relogSnapshot = _textController.snapshot();
    }
    _runAnalyze(
      text,
      refs: _failedRefs.isEmpty ? null : _failedRefs,
      pickNames: _failedPicks,
      isCheat: _failedCheat,
      label: _failedLabel,
    );
  }

  /// Discard a failed attempt: drop the card and retire its attempt id (the raw
  /// text stays in the composer to re-log by hand).
  void _discardFailed() {
    setState(() {
      _failedText = null;
      // Retire the whole record with it. `_failedText == null` already stops
      // `_retry`, but leaving references behind means the NEXT failed attempt
      // inherits them if anything ever reads them before they are rewritten.
      _failedRefs = const [];
      _failedPicks = const [];
      _failedLabel = null;
      _failedCheat = false;
      _attemptId = null;
    });
  }

  /// Normal and Cheat are the persistent modes — selecting one keeps the
  /// composer in it and puts the cursor straight back in the field.
  void _setMode(MealLogMode mode) {
    ref.read(mealLogModeProvider.notifier).state = mode;
    _inputController.focus();
  }

  void _setCheatIntensity(CheatIntensity intensity) {
    ref.read(cheatIntensityProvider.notifier).state = intensity;
  }

  // Both one-shots open OVER the feed: there is no sheet of ours in the way, so
  // the mode sheet's own dismissal is the only thing to wait on.
  Future<void> _openModeSheet() => chooseLogMode(
    context,
    current: ref.read(mealLogModeProvider),
    onPersistentMode: _setMode,
    onManual: _openManualSheet,
    onBarcode: _openBarcodeSheet,
  );

  Future<void> _openManualSheet() => showManualLogSheet(
    context,
    userId: widget.profile.userId,
    date: widget.date,
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
    _revealRawInput = _inFlightLabel;
    _inFlightText = null;
    _inFlightPicks = const [];
    // A combined submit reached a confirmable card, so its picks are logged —
    // the composer was already cleared, and the snapshot is now spent.
    _relogSnapshot = null;
    HapticFeedback.lightImpact();
    _scrollToAnswer();
  }

  void _failAttempt(bool retryable, {bool paymentRequired = false}) {
    final text = _inFlightText;
    final snapshot = _relogSnapshot;
    setState(() {
      _failedText = text;
      _failedRetryable = retryable;
      // Hand the in-flight attempt's shape to the failed card verbatim — this
      // is what "Try again" replays.
      _failedRefs = _inFlightRefs;
      _failedPicks = _inFlightPicks;
      _failedLabel = _inFlightLabelText;
      _failedCheat = _inFlightCheat;
      _inFlightText = null;
      _inFlightPicks = const [];
      _inFlightLabelText = null;
      _inFlightRefs = const [];
      _relogSnapshot = null;
    });
    if (snapshot != null) {
      // A combined submit that never staged. Restore the composer VERBATIM —
      // text AND picks — rather than the stripped text the AI saw, or the retry
      // would log the free text without the dishes the user picked.
      //
      // UNCONDITIONALLY, unlike the plain-text branch below — and this DOES
      // cost something: the snapshot predates the submit, so anything typed
      // while the analysis was in flight is replaced by it. That is a chosen
      // trade, not an oversight. A reference cannot be retyped (the picker has
      // to be reopened and the dish found again), whereas a sentence can, and
      // the window is one failed analysis long. Web restores the same way, so
      // the two platforms lose the same keystrokes.
      _textController.restore(snapshot);
    } else if (text != null && _inputController.getText().trim().isEmpty) {
      _inputController.setText(text);
    }
    ref.read(streamAnalysisProvider.notifier).reset();
    if (paymentRequired && mounted) {
      context.push('/paywall');
    }
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
        onFailed:
            (retryable) =>
                _failAttempt(retryable, paymentRequired: next.paymentRequired),
      ),
    );

    // Hand-off from an off-feed composer. WATCHED, not listened to: the feed is
    // routinely not mounted when the meal is parked (the profile fetch holds it
    // behind a skeleton), so a listener would miss the transition outright —
    // watching means the very first build that runs, whenever it runs, sees the
    // value. It also covers the opposite case, an already-mounted feed on
    // another tab: writing the provider marks this element dirty and the
    // resulting build picks it up.
    final pendingMeal = ref.watch(pendingMealProvider);
    if (pendingMeal != null && !_claimedPendingMeal) {
      _claimedPendingMeal = true;
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _consumePendingMeal(),
      );
    }

    final profile = widget.profile;
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
      streamingRawInput: _inFlightLabel,
      loaderIndex: _loaderIndex,
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
          onCheatIntensityChange: _setCheatIntensity,
          userId: widget.profile.userId,
          stagingRepeat: _stagingRepeat,
          onRepeatCheat: _repeatCheat,
          controller: _inputController,
          textController: _textController,
          onSync: _onComposerSync,
          relogQuery: _relogQuery,
          onSelectRelog: _selectRelogCandidate,
          onDismissRelog: () => _closeRelogPicker(_picker.dismiss()),
          onSubmit: _submitComposer,
          onCancel: () => ref.read(streamAnalysisProvider.notifier).cancel(),
          analyzing: stream.isAnalyzing,
          onModePressed: _openModeSheet,
          onBarcodePressed: _openBarcodeSheet,
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
        footer: footer,
        onRefresh: mealActions.refreshDay,
        onRetryDay: () => ref.invalidate(loggingDayProvider(_dayArgs)),
        onRemoveMeal: mealActions.remove,
        onUpdateMeal: mealActions.update,
        onLogAgain: mealActions.logAgain,
      ),
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
      // A clarify is a fresh analysis, so it gets a fresh loader — this path
      // bypasses _runAnalyze and would otherwise reuse the last run's.
      _loaderIndex = pickLoaderIndex();
    });
    _scrollToAnswer();
    startMealAnalysis(
      ref,
      message: text,
      date: widget.date,
      isCheat: true,
      cheatIntensity: ref.read(cheatIntensityProvider),
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
