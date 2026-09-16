import 'package:flutter/foundation.dart';

/// What the sheet did, handed back so the CALLER can confirm it.
@immutable
class ShareMealOutcome {
  const ShareMealOutcome({
    required this.mealId,
    required this.isSplit,
    required this.count,
  });

  final String mealId;
  final bool isSplit;
  final int count;
}
