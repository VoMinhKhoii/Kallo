/// SSE streaming event models.
///
/// Ported from `lib/ai/streaming/types.ts`.
library;

import 'cheat.dart';
import 'meal.dart';

/// Pipeline stages emitted as progress updates.
enum PipelineStage {
  authenticating,
  decomposing,
  matching,
  estimating,
  assembling,
}

/// Union of all SSE event types.
sealed class StreamEvent {
  const StreamEvent();

  factory StreamEvent.fromJson(Map<String, dynamic> json) {
    final type = json['type'] as String;
    return switch (type) {
      'stage' => StageEvent.fromJson(json),
      'item_name' => ItemNameEvent.fromJson(json),
      'item_macros' => ItemMacrosEvent.fromJson(json),
      'result' => ResultEvent.fromJson(json),
      'cheat_estimate' => CheatEstimateEvent.fromJson(json),
      'analysis_complete' => AnalysisCompleteEvent.fromJson(json),
      'error' => StreamErrorEvent.fromJson(json),
      _ => throw ArgumentError('Unknown StreamEvent type: $type'),
    };
  }
}

/// Progress update -- which pipeline stage is active.
class StageEvent extends StreamEvent {
  final PipelineStage stage;
  final String? message;

  const StageEvent({required this.stage, this.message});

  factory StageEvent.fromJson(Map<String, dynamic> json) => StageEvent(
        stage: PipelineStage.values.byName(json['stage'] as String),
        message: json['message'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'type': 'stage',
        'stage': stage.name,
        'message': message,
      };
}

/// Single meal item name discovered during decomposition streaming.
class ItemNameEvent extends StreamEvent {
  final String name;
  final int index;
  final String mealItemId;

  const ItemNameEvent({
    required this.name,
    required this.index,
    required this.mealItemId,
  });

  factory ItemNameEvent.fromJson(Map<String, dynamic> json) => ItemNameEvent(
        name: json['name'] as String,
        index: json['index'] as int,
        mealItemId: json['mealItemId'] as String,
      );

  Map<String, dynamic> toJson() => {
        'type': 'item_name',
        'name': name,
        'index': index,
        'mealItemId': mealItemId,
      };
}

/// Single meal item with macros estimated during nutrition streaming.
class ItemMacrosEvent extends StreamEvent {
  final String mealItemId;
  final MealItem item;

  const ItemMacrosEvent({
    required this.mealItemId,
    required this.item,
  });

  factory ItemMacrosEvent.fromJson(Map<String, dynamic> json) =>
      ItemMacrosEvent(
        mealItemId: json['mealItemId'] as String,
        item: MealItem.fromJson(json['item'] as Map<String, dynamic>),
      );

  Map<String, dynamic> toJson() => {
        'type': 'item_macros',
        'mealItemId': mealItemId,
        'item': item.toJson(),
      };
}

/// Final display-optimized result for the client.
class ResultEvent extends StreamEvent {
  final ParsedMeal data;

  const ResultEvent({required this.data});

  factory ResultEvent.fromJson(Map<String, dynamic> json) => ResultEvent(
        data: ParsedMeal.fromJson(json['data'] as Map<String, dynamic>),
      );

  Map<String, dynamic> toJson() => {
        'type': 'result',
        'data': data.toJson(),
      };
}

/// Cheat-meal slider spec (mode='cheat'); replaces `result`. When the spec
/// carries a clarifyingQuestion the stream ends WITHOUT analysis_complete —
/// the client must re-ask with `clarifyAnswer`.
class CheatEstimateEvent extends StreamEvent {
  final CheatSliderSpec spec;

  const CheatEstimateEvent({required this.spec});

  factory CheatEstimateEvent.fromJson(Map<String, dynamic> json) =>
      CheatEstimateEvent(
        spec: CheatSliderSpec.fromJson(json['spec'] as Map<String, dynamic>),
      );

  Map<String, dynamic> toJson() => {
        'type': 'cheat_estimate',
        'spec': spec.toJson(),
      };
}

/// Analysis stored durably -- safe to confirm and persist.
class AnalysisCompleteEvent extends StreamEvent {
  final String analysisId;

  const AnalysisCompleteEvent({required this.analysisId});

  factory AnalysisCompleteEvent.fromJson(Map<String, dynamic> json) =>
      AnalysisCompleteEvent(
        analysisId: json['analysisId'] as String,
      );

  Map<String, dynamic> toJson() => {
        'type': 'analysis_complete',
        'analysisId': analysisId,
      };
}

/// Error during streaming -- terminal event.
class StreamErrorEvent extends StreamEvent {
  final String code;
  final String message;
  final bool retryable;

  const StreamErrorEvent({
    required this.code,
    required this.message,
    required this.retryable,
  });

  factory StreamErrorEvent.fromJson(Map<String, dynamic> json) =>
      StreamErrorEvent(
        code: json['code'] as String,
        message: json['message'] as String,
        retryable: json['retryable'] as bool,
      );

  Map<String, dynamic> toJson() => {
        'type': 'error',
        'code': code,
        'message': message,
        'retryable': retryable,
      };
}

/// Client-side stream status.
enum StreamStatus {
  idle,
  connecting,
  authenticating,
  decomposing,
  matching,
  estimating,
  assembling,
  done,
  error,
}
