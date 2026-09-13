import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// Loads the app's real bundled font into the test binding.
///
/// **Call this in any test that measures or asserts on text WIDTH.** Without
/// it `flutter_test` renders every glyph in a placeholder font whose advance is
/// roughly 1em, so a 12pt "500 g" measures ~61pt instead of its real ~36pt.
/// That is not a small error — it is large enough to invent layout bugs that do
/// not exist (and, in the other direction, to hide ones that do). A grill pass
/// on the portion picker reported a fabricated clipping bug for exactly this
/// reason before the font was loaded.
///
/// Height assertions are safe without it: the calm type tokens all set an
/// explicit `height` multiplier, so line boxes are font-independent.
/// All four declared weights, matching `pubspec.yaml`. Loading only 400/500
/// (as this did until 2026-09-13) does not fail — Flutter silently picks the
/// nearest loaded face — so a w600 title renders as Medium, which is both the
/// wrong advance for a width assertion and the wrong rasterisation for a
/// golden. Under-loading is invisible until something compares pixels.
const _weights = ['Regular', 'Medium', 'SemiBold', 'Bold'];

Future<void> loadAppFonts() async {
  final loader = FontLoader('BeVietnamPro');
  for (final weight in _weights) {
    loader.addFont(
      rootBundle.load('assets/google_fonts/BeVietnamPro-$weight.ttf'),
    );
  }
  await loader.load();
}

/// Loads the Lucide icon faces the app actually draws with.
///
/// **Golden tests only.** Without it every `Icon` rasterises as a tofu box, so
/// the image records a placeholder where the design has a glyph — a golden that
/// cannot tell a check from an X, and that misrepresents the screen to anyone
/// reviewing it. Ordinary widget tests do not need it: an Icon occupies its
/// declared size either way, so nothing but the pixels changes.
///
/// The family carries the `packages/<pkg>/` prefix because the icons declare a
/// `fontPackage`; that prefixed name is what the engine resolves at paint time.
Future<void> loadIconFonts() async {
  const package = 'lucide_icons_flutter';
  // The app draws the 300 weight (`LucideIcons.check300`, `x300`).
  const weights = {'Lucide300': 'LucideVariable-w300'};
  for (final entry in weights.entries) {
    final loader = FontLoader('packages/$package/${entry.key}');
    loader.addFont(
      rootBundle.load('packages/$package/assets/build_font/${entry.value}.ttf'),
    );
    await loader.load();
  }
}
