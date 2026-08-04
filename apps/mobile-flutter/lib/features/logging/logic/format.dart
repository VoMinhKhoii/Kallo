/// Inline nutrition formatting — matches the web's display conventions.
///
/// Ported 1:1 from `apps/mobile/src/lib/logging/logic/format.ts`.
library;

/// Grams, rounded — `123g`, or `N/A` when null.
String fmtG(double? n) => n == null ? 'N/A' : '${n.round()}g';

/// Kilocalories, rounded — `456 kcal`, or `N/A` when null.
String fmtKcal(double? n) => n == null ? 'N/A' : '${n.round()} kcal';

/// Round to a whole number; null → 0.
int round0(double? n) => n == null ? 0 : n.round();

/// A bare kcal figure with no unit — the caller supplies it from the localized
/// string. Unknown renders as an em dash, never as zero.
///
/// Mirrors `formatKcal` in the web's `lib/logging/manual-logging.ts`, so the
/// relog picker reads the same on both surfaces.
String fmtKcalValue(double? n) => n == null ? '—' : '${n.round()}';

/// Grams of a macro with no unit: one decimal under 10g, whole numbers above —
/// small macros are where a rounded `0` would misread as "none".
///
/// Mirrors `formatMacro` in the web's `lib/logging/manual-logging.ts`.
String fmtMacroValue(double? n) {
  if (n == null) return '—';
  return n < 10 ? n.toStringAsFixed(1) : '${n.round()}';
}
