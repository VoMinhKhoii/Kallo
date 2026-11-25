import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'kallo_palette.dart';

/// The palette for the phone at [platform] brightness: light, or Aurora in
/// dark mode.
///
/// There is no theme setting: the phone decides, so the app always matches
/// the launch screen iOS draws before any app code runs (it can only follow
/// the phone).
KalloPaletteId resolvePalette(Brightness platform) =>
    platform == Brightness.dark ? KalloPaletteId.aurora : KalloPaletteId.light;

/// Makes [id] the palette every token reads from the next build on, and sets
/// the status-bar content to match: dark glyphs on light (today's style),
/// light glyphs on Dark and Aurora.
void applyPalette(KalloPaletteId id) {
  KalloPalette.apply(id);
  final dark = KalloPalette.current.isDark;
  SystemChrome.setSystemUIOverlayStyle(
    SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: dark ? Brightness.light : Brightness.dark,
      statusBarBrightness: dark ? Brightness.dark : Brightness.light,
    ),
  );
}

/// Rebuilds and repaints every mounted element IN PLACE.
///
/// Not a remount — a new key on the app root would throw away every State,
/// the navigation stack, scroll offsets and half-typed fields. Every element
/// is marked, `const` ones included, so a token read in any `build` picks up
/// the new palette. The repaint covers painters that read a token in `paint`
/// behind a `shouldRepaint` that only compares their data.
void rebuildAllElements() {
  void visit(Element element) {
    element.markNeedsBuild();
    if (element is RenderObjectElement) element.renderObject.markNeedsPaint();
    element.visitChildren(visit);
  }

  final root = WidgetsBinding.instance.rootElement;
  if (root != null) visit(root);
}

final kalloThemeProvider =
    NotifierProvider<KalloThemeController, KalloPaletteId>(
      KalloThemeController.new,
    );

/// Holds the painted palette and repaints the app in place when the phone
/// switches between light and dark.
///
/// Reads brightness through the binding's dispatcher rather than
/// `PlatformDispatcher.instance`: the same object in the app, and the one a
/// widget test can set.
class KalloThemeController extends Notifier<KalloPaletteId>
    with WidgetsBindingObserver {
  @override
  KalloPaletteId build() {
    final binding = WidgetsBinding.instance;
    binding.addObserver(this);
    ref.onDispose(() => binding.removeObserver(this));
    // `main()` already painted this before the first frame, so in the app
    // this is a no-op; nothing is built yet that would need a rebuild.
    final id = _phonePalette();
    if (id != KalloPalette.currentId) applyPalette(id);
    return id;
  }

  @override
  void didChangePlatformBrightness() {
    final id = _phonePalette();
    if (id == KalloPalette.currentId) return;
    applyPalette(id);
    rebuildAllElements();
    state = id;
  }

  KalloPaletteId _phonePalette() => resolvePalette(
    WidgetsBinding.instance.platformDispatcher.platformBrightness,
  );
}
