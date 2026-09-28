import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';

import '../../../logic/scan/amount.dart';
import '../../../logic/scan/food.dart';
import 'panel/page_stack.dart';
import 'result/others_panel.dart';
import 'result/panel.dart';
import 'screen.dart';

/// A result, or — one level in — its other nutrients.
ScanSheetPage scanResultPage(
  ScanScreenState s,
  ScanFood food, {
  required String key,
}) {
  final amount = s.amount ?? ScanAmount.initial(food);
  if (s.others) {
    return ScanSheetPage(
      key: ValueKey('$key-others'),
      level: 1,
      child: ScanOthersPanel(
        food: food,
        amount: amount,
        onBack: s.closeOthers,
        onClose: s.saving ? null : s.resumeScanning,
      ),
    );
  }
  return ScanSheetPage(
    key: ValueKey(key),
    level: 0,
    child: _resultPanel(s, food, amount),
  );
}

Widget _resultPanel(ScanScreenState s, ScanFood food, ScanAmount amount) {
  return ScanResultPanel(
    food: food,
    // A photographed or typed food is not a product the composer can hand
    // back by reference, so only an unedited barcode product takes the
    // purpose's "Add to meal"; everything else logs.
    ctaLabel:
        (food.logsByBarcode
                ? s.widget.purpose.ctaKey
                : 'logging.barcode.addMeal')
            .tr(),
    amount: amount,
    onAmount: s.setAmount,
    saving: s.saving,
    errorText: s.saveError,
    onClose: s.resumeScanning,
    onEdit: s.gated(() => s.openEditor(food, isNew: false)),
    onAdd: (resolved) => s.add(food, resolved),
    onOtherNutrients: s.openOthers,
  );
}
