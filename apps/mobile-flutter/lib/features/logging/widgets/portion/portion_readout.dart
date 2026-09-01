import 'package:flutter/material.dart';

import '../../../../shared/logic/display_format.dart';
import '../../../../theme/calm_tokens.dart';
import '../../logic/format.dart';

/// The picker's live `250 g · 410 kcal` line, shared by both vessel branches.
///
/// The grams carry the Value size (the one figure this sheet exists to set) and
/// the calories trail in Meta — the same hierarchy the web builds with
/// `text-lg` + `text-[13px]`, expressed in the mobile scale.
class PortionReadout extends StatelessWidget {
  const PortionReadout({super.key, required this.grams, required this.kcal});

  final int grams;
  final double kcal;

  @override
  Widget build(BuildContext context) {
    return Text.rich(
      TextSpan(
        children: [
          // dashValue is tabular by construction — no flag to pass.
          TextSpan(text: '$grams g', style: dashValue()),
          TextSpan(
            text: ' · ${fmtKcal(kcal, locale: localeOf(context))}',
            style: dashMeta(tabular: true),
          ),
        ],
      ),
      textAlign: TextAlign.center,
    );
  }
}
