/// What Free and Pro each get — the gate matrix of
/// `lib/domain/billing/entitlement/features.ts` and `docs/BILLING.md`, as the
/// eight rows the paywall prints.
///
/// Data, not presentation, so it lives out of the widget: the rows are a claim
/// about what the SERVER gates, and the one thing worth checking about them is
/// that the claim is true — which is a test that should not have to pump a
/// screen to read them.
library;

import 'package:easy_localization/easy_localization.dart';

/// What one tier gets on one row.
///
/// A sealed union rather than `Object?`: the three answers are a tick, a dash
/// and a short string, and spelling that as "any object, switched on `true`
/// and `null`, cast to String otherwise" made a fourth kind a runtime throw in
/// the default arm. Here it is a compile error at the one switch that renders
/// them.
sealed class Cell {
  const Cell();
}

/// The tier has it.
final class Included extends Cell {
  const Included();
}

/// The tier does not — a dash, not a cross: the row simply is not part of the
/// tier, and a dash says that more quietly.
final class Excluded extends Cell {
  const Excluded();
}

/// The answer is a number rather than a yes — "2 / 10", "Unlimited".
final class Quantity extends Cell {
  const Quantity(this.text);
  final String text;
}

/// One line of the comparison: what it is, and what each tier gets. [note] is
/// the single qualifier a tick cannot carry.
typedef CompareRow = ({String label, String? note, Cell free, Cell pro});

/// Reads as a table in source, the way it renders. Both tiers default to
/// [Excluded] because that is the common case — seven of the eight rows are
/// something Free does not get.
CompareRow _row(
  String label, {
  String? note,
  Cell free = const Excluded(),
  Cell pro = const Included(),
}) => (label: label, note: note, free: free, pro: pro);

/// What Free and Pro each get, as the gate matrix actually reads
/// (`lib/domain/billing/entitlement/features.ts`, and `docs/BILLING.md`).
///
/// Eight rows, consolidated from the eleven gates: the ones that ship or
/// withhold together say so on one line ("relog, cheat meal, split"). Two of
/// them exist to be GENEROUS rather than to sell — manual entry, barcode and
/// macro tracking are ticked in BOTH columns because they are ungated
/// forever, and a table that showed Free as empty would be a claim the code
/// does not support.
List<CompareRow> compareRows() => [
  _row(tr('paywall.compareLogging'), free: const Included()),
  _row(tr('paywall.compareMacros'), free: const Included()),
  _row(tr('paywall.compareAi')),
  _row(tr('paywall.compareLabel')),
  _row(tr('paywall.compareVisual')),
  _row(tr('paywall.compareMicros')),
  _row(tr('paywall.compareModes')),
  _row(
    tr('paywall.compareCircle'),
    // Reading, reacting and replying are never gated — only the COUNTS are.
    note: tr('paywall.compareCircleNote'),
    free: Quantity(tr('paywall.compareCircleFree')),
    pro: Quantity(tr('paywall.compareUnlimited')),
  ),
];
