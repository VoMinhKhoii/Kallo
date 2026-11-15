import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shared/widgets/dialog/kallo_alert_surface.dart';
import 'package:kallo_mobile/shared/widgets/toast/top_toast_pill.dart';
import 'package:kallo_mobile/shared/widgets/gauge/gauge_dial.dart';
import 'package:kallo_mobile/features/paywall/widgets/pitch/plan_comparison.dart';
import 'package:kallo_mobile/features/paywall/widgets/plans/plan_toggle.dart';
import 'package:kallo_mobile/features/paywall/widgets/plans/paywall_buy_band.dart';
import 'package:kallo_mobile/shared/widgets/menu/kallo_menu_card.dart';

/// Record geometry beside the renders so review numbers are reproducible.
void reviewMeasurements(WidgetTester tester, String surface, String pose) {
  final values = <String, Object>{};
  void rect(String name, Finder finder) {
    if (finder.evaluate().isNotEmpty) {
      values[name] = tester.getRect(finder.first);
    }
  }

  if (surface == 'nutrition') {
    rect('30 days', find.text('30 days'));
    rect('90 days', find.text('90 days'));
    rect('axis 1500', find.text('1500'));
  }
  if (surface == 'today') {
    rect('salmon', find.text('Grilled salmon, roasted potatoes'));
    rect('kcal', find.text('620 kcal'));
  }
  if (surface == 'paywall') {
    rect('band', find.byType(PaywallBuyBand));
    rect('toggle', find.byType(PlanToggle));
    rect('table', find.byType(PlanComparison));
  }
  if (surface == 'circle') {
    for (final text in ['460 kcal', 'P 22g', 'C 48g', 'F 20g']) {
      rect(text, find.text(text));
    }
  }
  if (surface == 'log') {
    values['readout scales'] =
        tester
            .widgetList<GaugeDial>(find.byType(GaugeDial))
            .map((dial) => dial.readoutScale)
            .toList();
  }
  if (surface == 'confirm') rect('alert', find.byType(KalloAlertSurface));
  if (surface == 'toast') rect('toast', find.byType(TopToastPill));
  if (surface == 'menu') rect('menu', find.byType(KalloMenuCard));
  // Kept in the gallery log, not in golden pixels.
  debugPrint('REVIEW $surface/$pose $values');
}
