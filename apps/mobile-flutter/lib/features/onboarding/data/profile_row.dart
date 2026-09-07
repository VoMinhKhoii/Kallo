/// The full `userProfiles` row returned by `GET /api/v1/onboarding/profile`.
///
/// RN models this as the loose Drizzle row type
/// (`NonNullable<Awaited<ReturnType<typeof getOnboardingProfile>>>`) and reads
/// individual fields off it ad hoc. We mirror that loose shape with a thin
/// wrapper over the decoded JSON map, exposing only the typed accessors the
/// wizard + gate logic actually read. `null` everywhere a field is absent.
library;

class ProfileRow {
  const ProfileRow(this.raw);

  /// The decoded JSON object as returned by the server (loose passthrough).
  final Map<String, dynamic> raw;

  factory ProfileRow.fromJson(Map<String, dynamic> json) => ProfileRow(json);

  Object? _get(String key) => raw[key];

  String? _string(String key) {
    final v = raw[key];
    return v is String ? v : null;
  }

  int? _int(String key) {
    final v = raw[key];
    if (v is int) return v;
    if (v is num) return v.toInt();
    return null;
  }

  /// The DB hands numeric/decimal columns back as strings; RN does
  /// `Number(profile.x)`. Returns null when absent or unparseable.
  double? _double(String key) {
    final v = raw[key];
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v);
    return null;
  }

  // ── Onboarding progress ────────────────────────────────────────────────
  int get onboardingStep => _int('onboardingStep') ?? 0;

  // ── Region / locale ────────────────────────────────────────────────────
  String? get countryOfOrigin => _string('countryOfOrigin');
  String? get countryOfResidence => _string('countryOfResidence');
  String? get preferredLocale => _string('preferredLocale');

  // ── Body metrics ───────────────────────────────────────────────────────
  String? get biologicalSex => _string('biologicalSex');

  double? get weightKg => _double('weightKg');

  int? get heightCm => _int('heightCm');
  int? get age => _int('age');
  String? get activityLevel => _string('activityLevel');
  String? get goal => _string('goal');

  /// `aggression` is stored as a string by the DB; the wizard parses it with a
  /// NaN-tolerant fallback (`parseAggression`). Returned raw here.
  String? get aggression => _string('aggression');

  String? get carbSplit => _string('carbSplit');

  /// Transient on the web, persisted by this server — and it CHANGES the
  /// computed target, so the wizard has to seed it rather than only post it
  /// back.
  double? get deficitOverride => _double('deficitOverride');

  // ── Cooking habits ─────────────────────────────────────────────────────
  String? get oilUsage => _string('oilUsage');
  String? get defaultRicePortion => _string('defaultRicePortion');
  String? get sugarBraised => _string('sugarBraised');
  String? get defaultProteinPortion => _string('defaultProteinPortion');
  String? get brothConsumption => _string('brothConsumption');

  /// Generic field read for the progress-resume heuristic.
  Object? field(String key) => _get(key);
}
