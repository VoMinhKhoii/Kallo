/// Nutrient-row status logic vendored from web `components/nutrition/rows/
/// nutrient-row.tsx` + `nutrient-detail.tsx` (keep in sync). `kStatusColors`
/// maps the web's `var(--kallo-heatmap-*)` to the mobile heatmap tokens.
///
/// Ported from `apps/mobile/src/lib/nutrition/logic/status.ts`.
library;

import 'dart:ui';

import '../../../models/nutrition.dart';
import '../../../theme/nham_colors.dart';

enum StatusKey { onTarget, close, slight, moderate, far }

const Map<StatusKey, Color> kStatusColors = {
  StatusKey.onTarget: NhamColors.heatmapOnTarget,
  StatusKey.close: NhamColors.heatmapClose,
  StatusKey.slight: NhamColors.heatmapSlight,
  StatusKey.moderate: NhamColors.heatmapModerate,
  StatusKey.far: NhamColors.heatmapFar,
};

StatusKey statusKeyFor(NutrientCardData card) {
  if (card.percentOfTarget == null) return StatusKey.slight;
  final pct = card.percentOfTarget!;
  final type = card.nutrientType;

  if (type == NutrientType.floor) {
    if (pct >= 90) return StatusKey.onTarget;
    if (pct >= 70) return StatusKey.close;
    if (pct >= 50) return StatusKey.slight;
    if (pct >= 30) return StatusKey.moderate;
    return StatusKey.far;
  }

  if (type == NutrientType.ceiling) {
    if (pct > 100) return StatusKey.far;
    if (pct >= 90) return StatusKey.onTarget;
    if (pct >= 70) return StatusKey.close;
    if (pct >= 50) return StatusKey.slight;
    return StatusKey.moderate;
  }

  // range: ±10% green, ±20% close, ±30% slight, beyond → moderate/far
  final delta = (pct - 100).abs();
  if (delta <= 10) return StatusKey.onTarget;
  if (delta <= 20) return StatusKey.close;
  if (delta <= 30) return StatusKey.slight;
  if (delta <= 50) return StatusKey.moderate;
  return StatusKey.far;
}

/// Whether to surface food-source chips for a nutrient: decent confidence and
/// meaningfully below target (<90%). Every card nutrient has DB-derived
/// suggestions, so there's no per-nutrient support gate.
bool showChips(NutrientCardData card) {
  return card.confidence >= 40 &&
      card.percentOfTarget != null &&
      card.percentOfTarget! < 90;
}
