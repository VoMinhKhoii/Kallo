/// Inline nutrition formatting — matches the web's display conventions.
///
/// Ported 1:1 from web `components/logging/feed/format-inline-nutrition.ts`.
library;

// `show`, because this file declares its own `round0` alongside the shared
// one — importing both unqualified would shadow rather than reconcile them.
import '../../../shared/logic/display_format.dart' show formatCount;

/// Grams, rounded — `123g`, or `N/A` when null.
///
/// No grouping: a macro figure that reaches four digits is a kilogram of one
/// nutrient, which does not happen. Calories do.
String fmtG(double? n) => n == null ? 'N/A' : '${n.round()}g';

/// Kilocalories, rounded and GROUPED for [locale] — `4,271 kcal` in en,
/// `4.271 kcal` in vi, or `N/A` when null.
///
/// Grouped because the calorie dial directly above these cards has always
/// grouped ([formatCount]), and device QA (2026-09-01) caught the pair on one
/// screen: the dial reading `4,789` over a card reading `4271 kcal`. Two
/// conventions for the same unit on the same surface reads as two different
/// kinds of number.
String fmtKcal(double? n, {required String locale}) =>
    n == null ? 'N/A' : '${formatCount(n.round(), locale)} kcal';

/// Round to a whole number; null → 0.
int round0(double? n) => n == null ? 0 : n.round();

/// A bare kcal figure with no unit — the caller supplies it from the localized
/// string. Unknown renders as an em dash, never as zero.
///
/// Mirrors `formatKcal` in the web's `lib/logging/manual-logging.ts`, so the
/// relog picker reads the same on both surfaces.
String fmtKcalValue(double? n, {required String locale}) =>
    n == null ? '—' : formatCount(n.round(), locale);

/// Grams of a macro with no unit: one decimal under 10g, whole numbers above —
/// small macros are where a rounded `0` would misread as "none".
///
/// Mirrors `formatMacro` in the web's `lib/logging/manual-logging.ts`.
String fmtMacroValue(double? n) {
  if (n == null) return '—';
  return n < 10 ? n.toStringAsFixed(1) : '${n.round()}';
}
