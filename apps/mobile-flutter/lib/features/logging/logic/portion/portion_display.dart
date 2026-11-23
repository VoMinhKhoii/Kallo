/// What a vessel + gram amount should *say* and *show*.
///
/// Ported from the label logic inside the web's `portion-assumption-line.tsx`.
/// Kept out of the widget so the honesty rule — a piece portion may only claim
/// a tier's name within ±10% of its grams, otherwise it states the raw grams —
/// is unit-testable and can't drift between the line and the picker.
library;

import '../../../../models/nutrition/vessel.dart';
import 'portion_anchors.dart';
import 'vessel_data.dart';

class PortionDisplay {
  final VesselAsset asset;
  final String label;

  const PortionDisplay({required this.asset, required this.label});
}

/// `"3 × "` for a multi-piece portion, empty otherwise. A container's count
/// is in its anchor labels already. Formatted like JS prints a number, so
/// `1.5 × lát`, never `1.5000 ×`.
String countPrefixFor(ClientVessel vessel) =>
    vessel is PieceVessel && vessel.count > 1 ? countPrefix(vessel.count) : '';

PortionDisplay portionDisplayFor(
  ClientVessel vessel,
  int grams,
  String locale,
) {
  switch (vessel) {
    case ContainerVessel():
      // By GRAMS, not by `vessel.tier`. The tier is Call 1's opening guess at
      // the vessel; the grams are what the estimator actually produced and what
      // gets committed. When they disagree the card said "medium plate" while
      // the picker it opened said "side plate · 16 cm" for the same 280 g.
      // The picker already reads the nearest anchor, so this is the side that
      // was lying. Half the first vessel counts as a reading too ("½ chén
      // nhỏ"), and a counted vessel says its count ("2 × tô vừa").
      final reading = containerReading(vessel, grams, locale);
      final tier = vesselFamilies[vessel.family]![reading.tier]!;
      return PortionDisplay(asset: tier.asset, label: reading.label);
    case PieceVessel():
      // Only claim a tier label the picker would also commit; otherwise state
      // the honest gram amount.
      final claimed = claimedAnchor(buildPieceAnchors(vessel, locale), grams);
      final tier = pieceTiers[(claimed?.tier ?? vessel.tier) - 1];
      final prefix = countPrefixFor(vessel);
      return PortionDisplay(
        asset: tier.assetFor(vessel.kind),
        label: claimed != null ? '$prefix${claimed.label}' : '$prefix$grams g',
      );
  }
}
