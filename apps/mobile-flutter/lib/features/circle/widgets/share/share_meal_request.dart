import 'package:flutter/foundation.dart';

/// The share the sheet built, handed back UNSENT so the caller can hold it for
/// the undo window and only post it if the user lets the toast run out.
@immutable
class ShareMealRequest {
  const ShareMealRequest({
    required this.mealId,
    required this.friendUserIds,
    required this.isSplit,
    this.myParts,
    this.splits,
  });

  final String mealId;
  final List<String> friendUserIds;
  final bool isSplit;
  final int? myParts;
  final List<Map<String, Object>>? splits;

  int get count => friendUserIds.length;
}
