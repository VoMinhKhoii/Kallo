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

sealed class ClientVessel {
  const ClientVessel();

  /// Parses a vessel payload, or returns null when it is absent or unusable.
  static ClientVessel? fromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    final tier = (json['tier'] as num?)?.toInt();
    if (tier == null) return null;

    if (json['family'] == 'piece') {
      final kind = _byNameOrNull(PieceKind.values, json['kind']);
      final count = (json['count'] as num?)?.toInt();
      if (kind == null || count == null || tier < 1 || tier > 5) return null;
      return PieceVessel(tier: tier, count: count, kind: kind);
    }

    final family = _byNameOrNull(ContainerFamily.values, json['family']);
    final dishClass = _byNameOrNull(DishClass.values, json['dishClass']);
    if (family == null || dishClass == null || tier < 1 || tier > 4) return null;
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
  final int count;
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
