import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../../../../shared/widgets/list/grouped_list_card.dart';
import '../../../../../../../shared/widgets/list/list_row.dart';
import '../../../../../../../shared/widgets/menu/kallo_pull_down.dart';
import '../../../../../logic/scan/amount.dart';

/// One portion a scan result can be logged by: "Serving", "Pack", "Custom".
class ScanPortionChoice {
  const ScanPortionChoice({
    required this.value,
    required this.label,
    required this.display,
    this.detail,
  });

  final ScanPortion value;

  /// The menu row ("Serving").
  final String label;

  /// What the Portion row shows once chosen ("100 ml / serving", "Pack").
  final String display;

  /// The menu row's muted size ("100 ml").
  final String? detail;
}

/// The result's amount card: Portion (a native pull-down), Amount (the − value
/// + control), and — for a drink's custom amount — the cup ruler under them.
///
/// Every row reads the same way (owner review): what it is on the left, its
/// value and control on the right. Layout only: the body supplies the choices,
/// the Amount control and the ruler.
class ScanAmountCard extends StatelessWidget {
  const ScanAmountCard({
    super.key,
    required this.choices,
    required this.selected,
    required this.onSelect,
    required this.amount,
    this.ruler,
  });

  final List<ScanPortionChoice> choices;
  final ScanPortion selected;

  /// Null while saving: the pull-down turns inert.
  final ValueChanged<ScanPortion>? onSelect;

  /// The Amount row's control, usually a `ScanAmountStepper`.
  final Widget amount;

  /// The cup ruler, when the amount is a drink's custom ml.
  final Widget? ruler;

  @override
  Widget build(BuildContext context) {
    final current = choices.firstWhere(
      (c) => c.value == selected,
      orElse: () => choices.last,
    );
    return GroupedListCard(
      separatorInset: 0,
      children: [
        ListRow(
          label: 'logging.scan.portion'.tr(),
          trailing: KalloPullDown<ScanPortion>(
            value: current.value,
            display: current.display,
            semanticLabel: 'logging.scan.portion'.tr(),
            options: [
              for (final c in choices)
                KalloPullDownOption(
                  value: c.value,
                  label: c.label,
                  detail: c.detail,
                ),
            ],
            onChanged: onSelect,
          ),
        ),
        ListRow(label: 'logging.scan.amount'.tr(), trailing: amount),
        if (ruler != null)
          Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 12),
            child: ruler,
          ),
      ],
    );
  }
}
