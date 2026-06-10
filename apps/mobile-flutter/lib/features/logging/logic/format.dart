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
