/// Cheat-meal slider models.
///
/// Ported from `lib/types/cheat.ts`. Instead of itemizing a buffet, the AI
/// turns the occasion into a small set of labeled 0–10 sliders the user places
/// themselves on. Each macro slider owns exactly one nutrient axis
/// (protein / carbs / fat); the optional drinks slider is the one
/// multi-nutrient axis (soda→carbs, creamy→fat, alcohol→ethanol). Calories
/// derive from 4·P + 4·C + 9·F + 7·alcohol.
library;

/// The slider axes a cheat spec can carry.
enum CheatSliderKey {
  protein,
  carbs,
  fat,
  drinks;

  /// Wire name — matches the web `CheatSliderKey` string union.
  String get wire => name;

  static CheatSliderKey fromWire(String value) =>
      CheatSliderKey.values.byName(value);
}

/// User-chosen indulgence magnitude for a cheat occasion (scales anchor grams
/// server-side; sent as `cheatIntensity` on analyze).
enum CheatIntensity { light, medium, heavy }

double? _num(Object? v) => v == null ? null : (v as num).toDouble();

/// A sparse keypoint on a slider. The server canonicalizes anchors onto the
/// six stops 0/2/4/6/8/10; grams at intermediate levels are interpolated.
/// Macro sliders carry only their own axis; drinks anchors may carry
/// carbohydrateG/fatG/alcoholG.
class CheatSliderAnchor {
  /// 0..10 position on the slider.
  final double level;

  /// Context-interpretable scenario, localized, e.g. "vài miếng nigiri".
  final String label;
  final double? proteinG;
  final double? carbohydrateG;
  final double? fatG;
  final double? alcoholG;

  const CheatSliderAnchor({
    required this.level,
    required this.label,
    this.proteinG,
    this.carbohydrateG,
    this.fatG,
    this.alcoholG,
  });

  factory CheatSliderAnchor.fromJson(Map<String, dynamic> json) =>
      CheatSliderAnchor(
        level: (json['level'] as num).toDouble(),
        label: json['label'] as String? ?? '',
        proteinG: _num(json['proteinG']),
        carbohydrateG: _num(json['carbohydrateG']),
        fatG: _num(json['fatG']),
        alcoholG: _num(json['alcoholG']),
      );

  Map<String, dynamic> toJson() => {
    'level': level,
    'label': label,
    if (proteinG != null) 'proteinG': proteinG,
    if (carbohydrateG != null) 'carbohydrateG': carbohydrateG,
    if (fatG != null) 'fatG': fatG,
    if (alcoholG != null) 'alcoholG': alcoholG,
  };
}

class CheatSlider {
  final CheatSliderKey key;

  /// Localized dial name, e.g. "Thịt / hải sản".
  final String label;

  /// 0..10 — the AI's single best guess; the slider starts here.
  final double defaultLevel;
  final List<CheatSliderAnchor> anchors;

  const CheatSlider({
    required this.key,
    required this.label,
    required this.defaultLevel,
    required this.anchors,
  });

  factory CheatSlider.fromJson(Map<String, dynamic> json) => CheatSlider(
    key: CheatSliderKey.fromWire(json['key'] as String),
    label: json['label'] as String? ?? '',
    defaultLevel: (json['defaultLevel'] as num).toDouble(),
    anchors: (json['anchors'] as List<dynamic>? ?? [])
        .map((e) => CheatSliderAnchor.fromJson(e as Map<String, dynamic>))
        .toList(),
  );

  Map<String, dynamic> toJson() => {
    'key': key.wire,
    'label': label,
    'defaultLevel': defaultLevel,
    'anchors': anchors.map((a) => a.toJson()).toList(),
  };
}

/// Rare fallback when the free-text is too vague to anchor sliders.
class CheatClarifyingQuestion {
  final String prompt;
  final List<String>? options;

  const CheatClarifyingQuestion({required this.prompt, this.options});

  factory CheatClarifyingQuestion.fromJson(Map<String, dynamic> json) =>
      CheatClarifyingQuestion(
        prompt: json['prompt'] as String? ?? '',
        options: (json['options'] as List<dynamic>?)?.cast<String>(),
      );

  Map<String, dynamic> toJson() => {
    'prompt': prompt,
    if (options != null) 'options': options,
  };
}

/// Full estimator output — the `cheat_estimate` SSE payload and the staged
/// spec a cheat pending confirmation carries.
class CheatSliderSpec {
  final List<CheatSlider> sliders;
  final String? mealSlot;
  final String? confidence;

  /// Present only when the model could not set sensible anchors — the stream
  /// then ends without an analysis_complete and the client must re-ask with
  /// `clarifyAnswer`.
  final CheatClarifyingQuestion? clarifyingQuestion;

  const CheatSliderSpec({
    required this.sliders,
    this.mealSlot,
    this.confidence,
    this.clarifyingQuestion,
  });

  factory CheatSliderSpec.fromJson(Map<String, dynamic> json) =>
      CheatSliderSpec(
        sliders: (json['sliders'] as List<dynamic>? ?? [])
            .map((e) => CheatSlider.fromJson(e as Map<String, dynamic>))
            .toList(),
        mealSlot: json['mealSlot'] as String?,
        confidence: json['confidence'] as String?,
        clarifyingQuestion: json['clarifyingQuestion'] == null
            ? null
            : CheatClarifyingQuestion.fromJson(
                json['clarifyingQuestion'] as Map<String, dynamic>,
              ),
      );

  Map<String, dynamic> toJson() => {
    'sliders': sliders.map((s) => s.toJson()).toList(),
    'mealSlot': mealSlot,
    'confidence': confidence,
    if (clarifyingQuestion != null)
      'clarifyingQuestion': clarifyingQuestion!.toJson(),
  };
}

/// Chosen slider positions keyed by axis (0..10). Wire shape is a plain
/// `{ "protein": 6, ... }` object — see [cheatLevelsToWire]/[cheatLevelsFromWire].
typedef CheatSliderLevels = Map<CheatSliderKey, double>;

/// Serialize levels for the confirm body (`levels` on POST /api/v1/meals/confirm).
Map<String, double> cheatLevelsToWire(CheatSliderLevels levels) =>
    levels.map((key, value) => MapEntry(key.wire, value));

CheatSliderLevels cheatLevelsFromWire(Map<String, dynamic> json) => {
  for (final entry in json.entries)
    CheatSliderKey.fromWire(entry.key): (entry.value as num).toDouble(),
};

/// Persisted JSONB shape in `meals.cheat_sliders` — spec + the user's choices.
class CheatSlidersPersisted {
  final CheatSliderSpec spec;
  final CheatSliderLevels levels;

  const CheatSlidersPersisted({required this.spec, required this.levels});

  factory CheatSlidersPersisted.fromJson(Map<String, dynamic> json) =>
      CheatSlidersPersisted(
        spec: CheatSliderSpec.fromJson(json['spec'] as Map<String, dynamic>),
        levels: cheatLevelsFromWire(
          json['levels'] as Map<String, dynamic>? ?? const {},
        ),
      );

  Map<String, dynamic> toJson() => {
    'spec': spec.toJson(),
    'levels': cheatLevelsToWire(levels),
  };
}

/// A distinct past cheat occasion, surfaced as a "log it again" chip
/// (`GET /api/v1/meals/cheat-occasions`).
class RecentCheatOccasion {
  /// Source meal id — re-staged on tap to seed a fresh slider card.
  final String mealId;

  /// The occasion text (e.g. "Korean BBQ buffet"), shown on the chip.
  final String rawInput;
  final String loggedAt;

  const RecentCheatOccasion({
    required this.mealId,
    required this.rawInput,
    required this.loggedAt,
  });

  factory RecentCheatOccasion.fromJson(Map<String, dynamic> json) =>
      RecentCheatOccasion(
        mealId: json['mealId'] as String,
        rawInput: json['rawInput'] as String? ?? '',
        loggedAt: json['loggedAt'] as String,
      );
}
