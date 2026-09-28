import 'package:easy_localization/easy_localization.dart';

import 'amount.dart';
import 'food.dart';

/// Under a result's name: the brand, or that the numbers are the label's.
/// Shared by the result and its other nutrients, which keep the same header.
String? scanFoodSubtitle(ScanFood food) =>
    food.source == ScanFoodSource.label
        ? 'logging.scan.fromLabel'.tr()
        : food.brand;

/// What the nutrients shown are for: "In 2 servings · 200 ml", "In 250 ml".
String scanAmountCaption(ScanFood food, ScanAmount amount, double resolved) {
  final unit = food.unit;
  String withSize(int n, String wordKey) =>
      unit == 'serving'
          ? '$n ${wordKey.plural(n)}'
          : '$n ${wordKey.plural(n)} · ${formatSize(resolved, unit)}';
  final text = switch (amount.portion) {
    ScanPortion.serving => withSize(
      amount.servings,
      'logging.scan.servingWord',
    ),
    ScanPortion.pack => withSize(amount.packs, 'logging.scan.packWord'),
    ScanPortion.custom =>
      unit == 'serving'
          ? withSize(amount.custom.round(), 'logging.scan.servingWord')
          : formatSize(resolved, unit),
  };
  return 'logging.scan.inAmount'.tr(namedArgs: {'amount': text});
}
