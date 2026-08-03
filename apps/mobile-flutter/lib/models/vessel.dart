/// The served-portion vessel the AI assumed for a dish.
///
/// Ported from `lib/ai/portion/vessel-types.ts` (the `ClientVessel` union). The
/// server attaches this to every meal item in `toParsedMeal`, so it arrives on
/// both the SSE `result` frame and the restored `/api/v1/meals/pending` rows.
/// Only the client-facing shape is modelled here — the pipeline's `provenance`
/// discriminator is stripped server-side before it reaches us.
library;

enum ContainerFamily { bowl, plate, cup }

enum DishClass { soup, solid, airy, drink }

enum PieceKind { fish, meat, poultry }

/// Resolve an enum by name, or null when the server sends a value this build
/// doesn't know. Deliberately lenient: a vessel is a display affordance, and a
/// new server-side family must degrade to "no portion line" rather than throw
/// and take the whole logging feed down with it.
T? _byNameOrNull<T extends Enum>(List<T> values, Object? name) {
  if (name is! String) return null;
  for (final value in values) {
    if (value.name == name) return value;
  }
  return null;
}

/// A tier index, or null unless it is a whole number inside [min]..[max].
///
/// Reads with `is num` rather than an `as num?` cast on purpose: a cast throws
/// on a type mismatch, and a throw here escapes `MealItem.fromJson` and fails
/// the ENTIRE meal — one malformed optional field would blank the day's feed
/// over a decoration. Every field in this file degrades; none of them throw.
int? _tierOrNull(Object? raw, {required int max}) {
  if (raw is! num || !raw.isFinite) return null;
  final value = raw.toInt();
  if (value != raw) return null; // 2.5 is not a tier
  return (value < 1 || value > max) ? null : value;
}

/// A piece count, or null unless it is finite and at least 1.
///
/// Fractions ARE valid and must survive: the decomposition prompt emits "một
/// lát rưỡi" as 1.5, and truncating it would build different anchors from web's
/// for the same meal. Only the impossible values are rejected.
///
/// Mirrors the server's own guard (`lib/ai/portion/piece-vessel.ts` rejects
/// `count < 1`). Without it, hostile or corrupt values reach the arithmetic and
/// do real damage: `-1` builds a descending envelope whose `clamp(-18, -600)`
/// throws while opening the sheet, `NaN`/`Infinity` throw in `gramEnvelope`,
/// `0` shows a 0 g picker that silently commits 10 g, and `1e9` stages a
/// 600-billion-gram portion for confirmation.
double? _countOrNull(Object? raw) {
  if (raw is! num || !raw.isFinite) return null;
  final value = raw.toDouble();
  return (value < 1 || value > maxPieceCount) ? null : value;
}

/// Beyond this many pieces the vessel stops being a useful affordance and is
/// almost certainly corruption or a hallucinated number. The picker would
/// otherwise happily build an envelope around it: `count: 1e9` yields a
/// 18-billion-to-600-billion-gram range, clamps a normal 150 g dish up to the
/// floor of that range, and stages it — macros scaled by ~1.2e8 — for the user
/// to confirm. 100 of the largest cut is already 60 kg of food; nothing real
/// is past it.
const double maxPieceCount = 100;

sealed class ClientVessel {
  const ClientVessel();

  /// Parses a vessel payload, or returns null when it is absent or unusable.
  /// NEVER throws — see [_tierOrNull].
  static ClientVessel? fromJson(Object? json) {
    if (json is! Map) return null;

    if (json['family'] == 'piece') {
      final tier = _tierOrNull(json['tier'], max: 5);
      final kind = _byNameOrNull(PieceKind.values, json['kind']);
      final count = _countOrNull(json['count']);
      if (tier == null || kind == null || count == null) return null;
      return PieceVessel(tier: tier, count: count, kind: kind);
    }

    final tier = _tierOrNull(json['tier'], max: 4);
    final family = _byNameOrNull(ContainerFamily.values, json['family']);
    final dishClass = _byNameOrNull(DishClass.values, json['dishClass']);
    if (tier == null || family == null || dishClass == null) return null;
    return ContainerVessel(family: family, tier: tier, dishClass: dishClass);
  }

  Map<String, dynamic> toJson();
}

/// A bowl / plate / cup — four tiers, sized by volume.
class ContainerVessel extends ClientVessel {
  final ContainerFamily family;

  /// 1–4.
  final int tier;
  final DishClass dishClass;

  const ContainerVessel({
    required this.family,
    required this.tier,
    required this.dishClass,
  });

  @override
  Map<String, dynamic> toJson() => {
    'family': family.name,
    'tier': tier,
    'dishClass': dishClass.name,
  };

  ContainerVessel copyWith({int? tier}) => ContainerVessel(
    family: family,
    tier: tier ?? this.tier,
    dishClass: dishClass,
  );

  @override
  bool operator ==(Object other) =>
      other is ContainerVessel &&
      other.family == family &&
      other.tier == tier &&
      other.dishClass == dishClass;

  @override
  int get hashCode => Object.hash(family, tier, dishClass);
}

/// A countable cut of fish / meat / poultry — five tiers, `count` of them.
class PieceVessel extends ClientVessel {
  /// 1–5.
  final int tier;

  /// How many pieces. Fractional by design — see [ClientVessel.fromJson].
  final double count;

  final PieceKind kind;

  const PieceVessel({
    required this.tier,
    required this.count,
    required this.kind,
  });

  @override
  Map<String, dynamic> toJson() => {
    'family': 'piece',
    'tier': tier,
    'count': count,
    'kind': kind.name,
  };

  PieceVessel copyWith({int? tier}) =>
      PieceVessel(tier: tier ?? this.tier, count: count, kind: kind);

  @override
  bool operator ==(Object other) =>
      other is PieceVessel &&
      other.tier == tier &&
      other.count == count &&
      other.kind == kind;

  @override
  int get hashCode => Object.hash(tier, count, kind);
}
