import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// Every weight `pubspec.yaml` declares. Loading only 400/500 (as this did
/// until 2026-09-13) does not fail — Flutter silently picks the nearest loaded
/// face — so a w600 title renders as Medium, which is both the wrong advance
/// for a width assertion and the wrong rasterisation for a golden.
/// Under-loading is invisible until something compares pixels, which is why
/// `app_fonts_test.dart` asserts this list against the pubspec rather than
/// trusting this comment.
const appFontWeights = ['Regular', 'Medium', 'SemiBold', 'Bold'];

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
Future<void> loadAppFonts() async {
  final loader = FontLoader('BeVietnamPro');
  for (final weight in appFontWeights) {
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
///
/// Loads the 300 weight only — the app also draws `*400` icons (the tab bar's
/// `plus400`, `house400`), so a golden over one of THOSE surfaces needs its
/// face added here or it bakes in tofu exactly as this function exists to
/// prevent. Kept to what the current goldens render: the Lucide faces are
/// ~455KB each, more than all four text weights combined.
Future<void> loadIconFonts() async {
  const family = 'Lucide300';
  const asset = 'LucideVariable-w300';
  const package = 'lucide_icons_flutter';
  final loader = FontLoader('packages/$package/$family');
  loader.addFont(
    rootBundle.load('packages/$package/assets/build_font/$asset.ttf'),
  );
  await loader.load();
}
