import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shell/kallo_app_theme.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';
import 'package:kallo_mobile/theme/kallo_palette.dart';
import 'package:kallo_mobile/theme/theme_controller.dart';

void main() {
  final binding = TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  tearDown(() {
    binding.platformDispatcher.clearPlatformBrightnessTestValue();
    KalloPalette.apply(KalloPaletteId.light);
  });

  group('resolvePalette', () {
    const expected = {
      (KalloThemeChoice.system, Brightness.light): KalloPaletteId.light,
      (KalloThemeChoice.system, Brightness.dark): KalloPaletteId.dark,
      (KalloThemeChoice.light, Brightness.light): KalloPaletteId.light,
      (KalloThemeChoice.light, Brightness.dark): KalloPaletteId.light,
      (KalloThemeChoice.dark, Brightness.light): KalloPaletteId.dark,
      (KalloThemeChoice.dark, Brightness.dark): KalloPaletteId.dark,
      (KalloThemeChoice.aurora, Brightness.light): KalloPaletteId.aurora,
      (KalloThemeChoice.aurora, Brightness.dark): KalloPaletteId.aurora,
    };
    for (final MapEntry(key: (choice, brightness), value: id)
        in expected.entries) {
      test(
        '${choice.name} on a ${brightness.name} phone paints ${id.name}',
        () {
          expect(resolvePalette(choice, brightness), id);
        },
      );
    }
  });

  group('persistence', () {
    test('reads the stored choice; anything else is System', () async {
      const storage = FlutterSecureStorage();
      expect(await readThemeChoice(storage), KalloThemeChoice.system);

      FlutterSecureStorage.setMockInitialValues({kThemeStorageKey: 'aurora'});
      expect(await readThemeChoice(storage), KalloThemeChoice.aurora);

      FlutterSecureStorage.setMockInitialValues({kThemeStorageKey: 'sepia'});
      expect(await readThemeChoice(storage), KalloThemeChoice.system);
    });

    test('select writes the choice under kallo.theme', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      await container
          .read(kalloThemeProvider.notifier)
          .select(KalloThemeChoice.dark);

      expect(container.read(kalloThemeProvider), KalloThemeChoice.dark);
      const storage = FlutterSecureStorage();
      expect(await storage.read(key: kThemeStorageKey), 'dark');
      expect(await readThemeChoice(storage), KalloThemeChoice.dark);
    });

    test('starts from the choice main() read', () {
      final container = ProviderContainer(
        overrides: [
          initialThemeChoiceProvider.overrideWithValue(KalloThemeChoice.aurora),
        ],
      );
      addTearDown(container.dispose);

      expect(container.read(kalloThemeProvider), KalloThemeChoice.aurora);
      expect(KalloPalette.currentId, KalloPaletteId.aurora);
    });
  });

  group('platform brightness', () {
    test('System follows the phone; an explicit choice does not', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final controller = container.read(kalloThemeProvider.notifier);
      expect(KalloPalette.currentId, KalloPaletteId.light);

      binding.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
      expect(KalloPalette.currentId, KalloPaletteId.dark);
      expect(KalloColors.surface, KalloPalette.dark.surface);

      await controller.select(KalloThemeChoice.light);
      expect(KalloPalette.currentId, KalloPaletteId.light);
      binding.platformDispatcher.platformBrightnessTestValue = Brightness.light;
      binding.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
      expect(KalloPalette.currentId, KalloPaletteId.light);

      await controller.select(KalloThemeChoice.system);
      expect(KalloPalette.currentId, KalloPaletteId.dark);
    });
  });

  group('switching in a running app', () {
    testWidgets('repaints a widget below in place — new colour, same State', (
      tester,
    ) async {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      await tester.pumpWidget(
        UncontrolledProviderScope(container: container, child: const _App()),
      );
      final before = tester.state<_ProbeState>(find.byType(_Probe));
      expect(before.painted, KalloPalette.light.surface);
      before.field.text = 'half-typed';
      final buildsBefore = before.builds;

      await container
          .read(kalloThemeProvider.notifier)
          .select(KalloThemeChoice.dark);
      await tester.pumpAndSettle();

      expect(KalloColors.surface, KalloPalette.dark.surface);
      final after = tester.state<_ProbeState>(find.byType(_Probe));
      expect(identical(after, before), isTrue, reason: 'State was remounted');
      expect(after.field.text, 'half-typed');
      expect(after.builds, greaterThan(buildsBefore));
      expect(after.painted, KalloPalette.dark.surface);
      expect(
        tester.widget<ColoredBox>(find.byKey(_Probe.boxKey)).color,
        KalloPalette.dark.surface,
      );
      final context = tester.element(find.byType(_Probe));
      expect(Theme.of(context).brightness, Brightness.dark);
    });

    testWidgets('System repaints when the phone changes brightness', (
      tester,
    ) async {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      await tester.pumpWidget(
        UncontrolledProviderScope(container: container, child: const _App()),
      );
      final state = tester.state<_ProbeState>(find.byType(_Probe));
      expect(state.painted, KalloPalette.light.surface);

      tester.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
      await tester.pumpAndSettle();

      expect(tester.state<_ProbeState>(find.byType(_Probe)), same(state));
      expect(state.painted, KalloPalette.dark.surface);
    });
  });
}

/// The app root in miniature: rebuilds `theme:` from the palette the way
/// `KalloApp` does, over a `const` probe nothing else would rebuild.
class _App extends ConsumerWidget {
  const _App();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(kalloThemeProvider);
    return MaterialApp(theme: kalloAppTheme(), home: const _Probe());
  }
}

class _Probe extends StatefulWidget {
  const _Probe();

  static const boxKey = Key('probe-box');

  @override
  State<_Probe> createState() => _ProbeState();
}

class _ProbeState extends State<_Probe> {
  final field = TextEditingController();
  int builds = 0;
  Color? painted;

  @override
  void dispose() {
    field.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    builds++;
    painted = KalloColors.surface;
    return ColoredBox(
      key: _Probe.boxKey,
      color: KalloColors.surface,
      child: const SizedBox.expand(),
    );
  }
}
