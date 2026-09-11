/// The feed's analysis run: what is in flight, what failed, what was revealed,
/// and the attempt id that ties a retry to the staging row the server already
/// wrote.
///
/// The other half of [analysis_actions.dart]: that file is the stateless edge —
/// how a run is handed to the stream and how the stream hands control back.
/// This is the state that edge moves through, and the one place the composer is
/// cleared, restored and re-snapshotted around it.
///
/// Long-lived (the feed's own lifetime), so `ref`, the day and the context are
/// passed IN per call rather than captured: `FeedArea` is not keyed by date, so
/// paging to another day changes the target under a state object that stays.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../../../models/logging/relog.dart';
import '../../../../../services/billing/feature_lock.dart';
import '../../../data/logging_providers.dart';
import '../../../data/stream_analysis_controller.dart';
import '../../../widgets/composer/meal_input.dart';
import '../../../widgets/loaders/loader_registry.dart';
import '../../../widgets/relog/mention_text_controller.dart';
import '../../meal_log_mode.dart';
import '../../relog/mentions.dart' show MentionSnapshot;
import '../../relog/relog_label.dart';
import 'analysis_actions.dart';
import 'analysis_attempt.dart';

const _uuid = Uuid();

class FeedAnalysisRun {
  FeedAnalysisRun({
    required this.composer,
    required this.input,
    required this.onChanged,
    required this.onScrollToAnswer,
  });

  /// The composer's text AND the relog picks living inside it. A run clears it
  /// on send and hands it back on failure.
  final MentionTextEditingController composer;

  /// The plain-text half of the same field — the run clears it on send and
  /// restores the typed sentence when there were no picks to give back.
  final MealInputController input;

  /// Something the feed renders changed — rebuild.
  final VoidCallback onChanged;

  /// Carry this turn to the top — on START, never when its answer lands.
  final VoidCallback onScrollToAnswer;

  /// The attempt currently in flight — handed back to the composer if it
  /// fails, so a failed analysis never destroys what the user typed. Null when
  /// nothing is out.
  AnalysisAttempt? _inFlight;

  /// What the in-flight run's card should SAY — see [AnalysisAttempt.label].
  String? get inFlightLabel => _inFlight?.shownLabel;

  /// The composer as it stood when a COMBINED submit (free text + picks) went
  /// out. That submit sends the free text alone and clears the field, so on any
  /// failure the picks must come back intact for a retry rather than vanishing
  /// behind a submit that produced no confirmable card.
  MentionSnapshot? _relogSnapshot;

  /// Which of the twelve loaders this run draws. Rolled once per submit and
  /// held for the whole run — a loader that changed mid-analysis would read as
  /// a restart. Lives HERE, not in the streaming widget, so a rebuild of the
  /// footer (a pending card arriving, say) cannot re-roll it.
  int _loaderIndex = 0;

  int get loaderIndex => _loaderIndex;

  /// When the current turn was sent. Drives the divider above the chat bubble,
  /// so the timeline is stamped the moment the user hits send rather than when
  /// the answer lands.
  DateTime? _sentAt;

  DateTime? get sentAt => _sentAt;

  /// The attempt that failed, rendered as a feed card with "Try again"
  /// (terracotta). Held WHOLE — references, pick names, label and mode, exactly
  /// as they went out — because "Try again" replays THIS: a retry can never
  /// attach picks the attempt never carried, or resubmit a cheat estimate as a
  /// normal analysis because the user changed mode while the error card sat
  /// there.
  AnalysisAttempt? _failed;

  String? get failedText => _failed?.text;

  /// Whether the failed attempt is worth retrying (from the error's `retryable`
  /// flag). When false the failed card offers only Discard, no "Try again".
  bool _failedRetryable = true;

  bool get failedRetryable => _failedRetryable;

  /// Stable per-attempt id for the run currently on screen. Minted fresh on a
  /// new submit; REUSED for a retry of a failed attempt and for a cheat-clarify
  /// resubmit, so the server upserts one staging row instead
  /// of orphaning its predecessor. Cleared once the attempt is saved or
  /// discarded; kept on error so the retry supersedes. Mirrors the web
  /// attemptId semantics (use-feed-submit / use-confirm-handlers).
  String? _attemptId;

  /// The day the run in flight was submitted ON, frozen at send. This object
  /// is not keyed by date (see the library note), so paging moves the day under
  /// it while an analysis is still out — and the completion used to take
  /// whatever day was on screen, riding Tuesday's feed to its tail for
  /// Monday's answer.
  String? _runDate;

  /// The raw text of the just-revealed answer — shown as the morph card's Lora
  /// quote so the confirmable card carries the user's own words, not a derived
  /// meal name (the streaming→reveal→persisted object stays continuous).
  String? _revealRawInput;

  String? get revealRawInput => _revealRawInput;

  /// A fresh logging attempt carrying no relog picks — a plain composer, the
  /// dashboard's quick-log sheet, a first-run suggestion chip.
  void startPlain(
    WidgetRef ref, {
    required String userId,
    required String date,
    required String text,
  }) {
    // A fresh logging attempt: mint a new attempt id. Retries and cheat-clarify
    // resubmits reuse the existing id instead (see [retry] / [retakeReveal]) so
    // the server upserts one staging row per attempt.
    _attemptId = _uuid.v4();
    _analyze(
      ref,
      userId: userId,
      date: date,
      attempt: AnalysisAttempt(text: text, isCheat: _modeIsCheat(ref)),
    );
  }

  /// A fresh logging attempt with picks riding along: [freeText] is analyzed
  /// alone and [refs] are sent beside it, so the server merges the copied
  /// dishes in and relogged items are never re-analyzed.
  void startCombined(
    WidgetRef ref, {
    required String userId,
    required String date,
    required String freeText,
    required List<ComposerPickRef> refs,
    required List<String> pickNames,
  }) {
    _attemptId = _uuid.v4();
    // [_analyze] clears the composer to show the streaming card, which drops
    // the mentions with it — snapshot first so a failed run can hand them back,
    // and take the label BEFORE the clear: it is the sentence on screen with
    // the `/` markers removed, so the card reads back what was typed, in that
    // order.
    _relogSnapshot = composer.snapshot();
    _analyze(
      ref,
      userId: userId,
      date: date,
      attempt: AnalysisAttempt(
        text: freeText,
        refs: refs,
        pickNames: pickNames,
        label: capDisplayText(unmarkPicks(composer.text, composer.entries)),
        isCheat: _modeIsCheat(ref),
      ),
    );
  }

  void retry(WidgetRef ref, {required String userId, required String date}) {
    final attempt = _failed;
    if (attempt == null) return;
    // Reuse the failed attempt's id so the retry supersedes its staging row
    // (kept on error precisely for this). Fall back to a fresh id defensively.
    _attemptId ??= _uuid.v4();

    // REPLAY the failed attempt — text, references and mode exactly as they
    // went out — rather than re-planning from the live composer.
    //
    // Re-planning read the composer's entries and the current mode against a
    // [_failed] text frozen at the moment of failure, and those two drift: the
    // composer stays editable while the error card sits there, and picks
    // survive a mode switch. A cheat submit that failed could come back as a
    // normal analysis carrying leftover picks the user never sent with it —
    // and since a cheat message is the RAW composer text, its `/Phở bò` would
    // reach the AI as prose while the ref copied the same dish again.
    if (attempt.refs.isNotEmpty) {
      // [_analyze] clears the composer again, so re-snapshot: a second failure
      // would otherwise have nothing to hand back.
      _relogSnapshot = composer.snapshot();
    }
    _analyze(ref, userId: userId, date: date, attempt: attempt);
  }

  /// Discard a failed attempt: drop the card and retire its attempt id (the raw
  /// text stays in the composer to re-log by hand).
  void discardFailed() {
    // The whole record goes, references and all: dropping the card is dropping
    // the attempt, and there is nothing left for the next failure to inherit.
    _failed = null;
    _attemptId = null;
    onChanged();
  }

  /// The revealed answer landed: it becomes the confirmable card, carrying the
  /// user's own words across.
  ///
  /// No rebuild is asked for — the stream provider the feed watches has already
  /// changed, which is what brought us here.
  void reveal(WidgetRef ref, {required String userId, required String date}) {
    // The run's OWN day, not the one the user happens to be looking at now.
    final runDate = _runDate ?? date;
    _revealRawInput = inFlightLabel;
    _inFlight = null;
    // A combined submit reached a confirmable card, so its picks are logged —
    // the composer was already cleared, and the snapshot is now spent.
    _relogSnapshot = null;
    // Pull the staged row into the day cache NOW, not at confirm. Until this
    // lands the card exists only in stream state, and a hot reload (Riverpod
    // re-runs Notifier.build) or a relaunch wiped it off a still-staged meal.
    refreshStagedAnalysisDay(ref, userId: userId, fallbackDate: runDate);
    // The answer's day is no longer on screen: the reveal is KEPT (paging back
    // finds it), but the haptic would be addressed to nothing. No ride to the
    // tail either, on any day — the send already carried this turn to the top
    // over a viewport of room, so scrolling again only pushed the sent message
    // off the screen as the revealed card took its final height.
    if (runDate != date) return;
    HapticFeedback.lightImpact();
  }

  void fail(
    BuildContext context,
    WidgetRef ref, {
    required bool retryable,
    bool paymentRequired = false,
  }) {
    final attempt = _inFlight;
    final snapshot = _relogSnapshot;
    // The in-flight attempt becomes the failed card verbatim — this is what
    // "Try again" replays.
    _failed = attempt;
    _failedRetryable = retryable;
    _inFlight = null;
    _relogSnapshot = null;
    onChanged();
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
      composer.restore(snapshot);
    } else if (attempt != null && input.getText().trim().isEmpty) {
      input.setText(attempt.text);
    }
    ref.read(streamAnalysisProvider.notifier).reset();
    // Through the shared helper, not a bare push: this runs inside a
    // `ref.listen` callback, and [openPaywall] is what defers the navigation
    // out of Riverpod's flush.
    if (paymentRequired && context.mounted) {
      openPaywall(context);
    }
  }

  /// A REVEALED answer was saved: drop its raw text, retire the attempt id and
  /// tear the local stream down so the revealed card hands off to the refetched
  /// persisted card. The reset is what rebuilds the feed.
  void revealSaved(WidgetRef ref) {
    _revealRawInput = null;
    // The attempt reached a confirmed save — retire its id.
    _attemptId = null;
    ref.read(streamAnalysisProvider.notifier).reset();
  }

  /// Put the revealed answer back into flight under the SAME attempt id, and
  /// hand the caller what a resend needs. Null when there is nothing revealed.
  ///
  /// The cheat estimator's vague-input fallback runs on this: nothing is staged
  /// for a vague input, so the clarify is a fresh analyze of the same occasion
  /// text — but a double-fired clarify WOULD stage twice, and sharing the id
  /// collapses that to one row.
  ({String text, String attemptId})? retakeReveal({required String date}) {
    final text = _revealRawInput;
    if (text == null || text.isEmpty) return null;
    final attemptId = _attemptId ??= _uuid.v4();
    _revealRawInput = null;
    // The clarify carries no picks (cheat mode cannot), so a bare attempt is
    // the whole of it.
    _inFlight = AnalysisAttempt(text: text, isCheat: true);
    // Bypasses [_analyze], but is still a run in flight — see [_runDate].
    _runDate = date;
    // A retake is a fresh analysis, so it gets a fresh loader and a fresh
    // timestamp — this path bypasses [_analyze] and would otherwise reuse the
    // previous run's.
    _loaderIndex = pickLoaderIndex();
    _sentAt = DateTime.now();
    onChanged();
    onScrollToAnswer();
    return (text: text, attemptId: attemptId);
  }

  /// Core analyze path shared by fresh submit and retry. Honors the persistent
  /// composer mode (precise vs cheat) — whichever surface last set it, the feed
  /// composer or the dashboard's quick-log sheet — and sends the current
  /// attempt id.
  void _analyze(
    WidgetRef ref, {
    required String userId,
    required String date,
    required AnalysisAttempt attempt,
  }) {
    refreshStagedAnalysisDay(ref, userId: userId, fallbackDate: date);
    _runDate = date;
    _failed = null;
    // Kept in lockstep with _failed (only read while _failed != null); reset it
    // explicitly so the invariant holds without relying on the error branch
    // always rewriting both.
    _failedRetryable = true;
    _revealRawInput = null;
    _inFlight = attempt;
    _loaderIndex = pickLoaderIndex();
    _sentAt = DateTime.now();
    onChanged();
    input.clear();
    onScrollToAnswer();
    startMealAnalysis(
      ref,
      message: attempt.text,
      date: date,
      isCheat: attempt.isCheat,
      cheatIntensity: ref.read(cheatIntensityProvider),
      attemptId: _attemptId,
      // Null, not empty: `startMealAnalysis` reads a null refs list as "no
      // picks" and drops the label with it.
      refs: attempt.refs.isEmpty ? null : attempt.refs,
      displayText: attempt.label,
    );
  }

  /// The persistent composer mode, read ONCE per attempt and frozen into it.
  /// Reading it again at retry time would let a mode switch turn a failed cheat
  /// estimate into a normal analysis.
  bool _modeIsCheat(WidgetRef ref) =>
      ref.read(mealLogModeProvider) == MealLogMode.cheat;
}
