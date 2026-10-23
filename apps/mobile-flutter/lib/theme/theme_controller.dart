import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'kallo_palette.dart';

/// Where the Appearance choice is kept — per device, in the keychain.
const String kThemeStorageKey = 'kallo.theme';

/// The palette [choice] paints while the phone is at [platform] brightness.
/// System follows the phone between light and Dark; Aurora is only chosen.
KalloPaletteId resolvePalette(
  KalloThemeChoice choice,
  Brightness platform,
) => switch (choice) {
  KalloThemeChoice.system =>
    platform == Brightness.dark ? KalloPaletteId.dark : KalloPaletteId.light,
  KalloThemeChoice.light => KalloPaletteId.light,
  KalloThemeChoice.dark => KalloPaletteId.dark,
  KalloThemeChoice.aurora => KalloPaletteId.aurora,
};

/// What `main()` read before the first frame.
///
/// [choice] is the stored choice; System for anything missing, unknown or
/// unreadable. The read is bounded because `main()` awaits it before `runApp`:
/// a keychain channel that never answers must not hold the launch screen. A
/// read that outlasts the bound paints the first frame as System, and [late]
/// still completes with the stored choice for the controller to adopt.
typedef ThemeChoiceRead =
    ({KalloThemeChoice choice, Future<KalloThemeChoice>? late});

Future<ThemeChoiceRead> readThemeChoice(
  FlutterSecureStorage storage, {
  Duration bound = const Duration(seconds: 1),
}) async {
  final read = storage
      .read(key: kThemeStorageKey)
      .then(
        (raw) => KalloThemeChoice.values.firstWhere(
          (choice) => choice.name == raw,
          orElse: () => KalloThemeChoice.system,
        ),
        onError: (Object _) => KalloThemeChoice.system,
      );
  try {
    return (choice: await read.timeout(bound), late: null);
  } on TimeoutException {
    return (choice: KalloThemeChoice.system, late: read);
  }
}

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

final themeStorageProvider = Provider<FlutterSecureStorage>(
  (ref) => const FlutterSecureStorage(),
);

/// The choice `main()` read before the first frame (it overrides this).
final initialThemeChoiceProvider = Provider<KalloThemeChoice>(
  (ref) => KalloThemeChoice.system,
);

/// The stored choice when `main()`'s read ran past its bound (it overrides
/// this); null when the read finished in time.
final lateThemeChoiceProvider = Provider<Future<KalloThemeChoice>?>(
  (ref) => null,
);

final kalloThemeProvider =
    NotifierProvider<KalloThemeController, KalloThemeChoice>(
      KalloThemeController.new,
    );

/// Settings → Appearance: holds the choice, persists it, and repaints the app
/// when the choice — or, under System, the phone's brightness — changes.
///
/// Reads brightness through the binding's dispatcher rather than
/// `PlatformDispatcher.instance`: the same object in the app, and the one a
/// widget test can set.
class KalloThemeController extends Notifier<KalloThemeChoice>
    with WidgetsBindingObserver {
  @override
  KalloThemeChoice build() {
    final binding = WidgetsBinding.instance;
    binding.addObserver(this);
    var disposed = false;
    ref.onDispose(() {
      disposed = true;
      binding.removeObserver(this);
    });
    final choice = ref.read(initialThemeChoiceProvider);
    // `main()` already painted this choice before the first frame, so in the
    // app this is a no-op; nothing is built yet that would need a rebuild.
    _paint(choice, rebuild: false);
    // A slow keychain read lands here; a choice made meanwhile wins.
    ref.read(lateThemeChoiceProvider)?.then((stored) {
      if (disposed || _chosen || stored == state) return;
      state = stored;
      _paint(stored, rebuild: true);
    });
    return choice;
  }

  bool _chosen = false;

  /// Switches to [choice] at once, then stores it for the next launch.
  ///
  /// Stores it even when it is already showing: under a late startup read the
  /// keychain may still hold an older choice that this one must replace.
  Future<void> select(KalloThemeChoice choice) async {
    _chosen = true;
    if (choice != state) {
      state = choice;
      _paint(choice, rebuild: true);
    }
    try {
      await ref
          .read(themeStorageProvider)
          .write(key: kThemeStorageKey, value: choice.name);
    } catch (_) {
      // The switch already happened; an unwritable keychain only costs the
      // next launch its memory of it.
    }
  }

  @override
  void didChangePlatformBrightness() {
    if (state == KalloThemeChoice.system) _paint(state, rebuild: true);
  }

  void _paint(KalloThemeChoice choice, {required bool rebuild}) {
    final brightness =
        WidgetsBinding.instance.platformDispatcher.platformBrightness;
    final id = resolvePalette(choice, brightness);
    if (id == KalloPalette.currentId) return;
    applyPalette(id);
    if (rebuild) rebuildAllElements();
  }
}
