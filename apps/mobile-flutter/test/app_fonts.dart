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
Future<void> loadAppFonts() async {
  final loader = FontLoader('BeVietnamPro');
  loader.addFont(
    rootBundle.load('assets/google_fonts/BeVietnamPro-Regular.ttf'),
  );
  loader.addFont(
    rootBundle.load('assets/google_fonts/BeVietnamPro-Medium.ttf'),
  );
  await loader.load();
}
