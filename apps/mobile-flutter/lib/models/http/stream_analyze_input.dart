/// The request body of the meal-analysis SSE stream.
library;

import '../logging/relog.dart';

/// Input for the meal-analysis SSE stream (`POST /api/analyze-meal`).
class StreamAnalyzeInput {
  final String message;
  final String loggedDate;
  final int timezoneOffset;
  final String? locale; // 'en' | 'vi'

  /// 'cheat' runs the slider estimator instead of the decomposition pipeline;
  /// omitted/null means 'precise' (the default pipeline).
  final String? mode;

  /// Indulgence magnitude for cheat mode — 'light' | 'medium' | 'heavy';
  /// scales the slider anchor grams server-side.
  final String? cheatIntensity;
  final String? cheatType;

  /// Reply to a prior vague-input cheat clarifying question.
  final String? clarifyAnswer;

  /// Stable per-attempt id. Reused across re-analyses of one logging attempt
  /// (retry, cheat-clarify resubmit) so the server upserts the same
  /// `pending_analyses` staging row instead of orphaning its predecessor. Sent
  /// only when set — a null attemptId always inserts a fresh row server-side.
  final String? attemptId;

  /// Relog picks riding alongside free text (precise mode only). The server
  /// runs the pipeline on [message] ALONE and merges these deterministically
  /// afterwards, so a relogged dish is copied verbatim, never re-estimated.
  ///
  /// The server rejects `mode: 'cheat'` together with refs rather than silently
  /// dropping them, so callers must keep this empty outside normal mode.
  final List<ComposerPickRef>? refs;

  /// What the saved meal is LABELLED with — the sentence on screen, markers
  /// off. [message] is that sentence with the picks CUT OUT, so without this
  /// the server rebuilds the label and appends them, reordering the sentence.
  final String? displayText;

  const StreamAnalyzeInput({
    required this.message,
    required this.loggedDate,
    required this.timezoneOffset,
    this.locale,
    this.mode,
    this.cheatIntensity,
    this.cheatType,
    this.clarifyAnswer,
    this.attemptId,
    this.refs,
    this.displayText,
  });

  Map<String, dynamic> toJson() => {
    'message': message,
    'loggedDate': loggedDate,
    'timezoneOffset': timezoneOffset,
    if (locale != null) 'locale': locale,
    if (mode != null) 'mode': mode,
    if (cheatIntensity != null) 'cheatIntensity': cheatIntensity,
    if (cheatType != null) 'cheatType': cheatType,
    if (clarifyAnswer != null) 'clarifyAnswer': clarifyAnswer,
    if (attemptId != null) 'attemptId': attemptId,
    if (refs != null && refs!.isNotEmpty)
      'refs': refs!.map((ref) => ref.toJson()).toList(),
    if (displayText != null) 'displayText': displayText,
  };
}
