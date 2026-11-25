import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shell/kallo_app_theme.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';
import 'package:kallo_mobile/theme/kallo_palette.dart';
import 'package:kallo_mobile/theme/theme_controller.dart';

void main() {
  final binding = TestWidgetsFlutterBinding.ensureInitialized();

  tearDown(() {
    binding.platformDispatcher.clearPlatformBrightnessTestValue();
    KalloPalette.apply(KalloPaletteId.light);
  });

  test('a light phone paints light; a dark one paints Aurora', () {
    expect(resolvePalette(Brightness.light), KalloPaletteId.light);
    expect(resolvePalette(Brightness.dark), KalloPaletteId.aurora);
  });

  test('starts in the phone\'s palette and follows it', () {
    binding.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
    final container = ProviderContainer();
    addTearDown(container.dispose);

    expect(container.read(kalloThemeProvider), KalloPaletteId.aurora);
    expect(KalloPalette.currentId, KalloPaletteId.aurora);
    expect(KalloColors.surface, KalloPalette.aurora.surface);

    binding.platformDispatcher.platformBrightnessTestValue = Brightness.light;
    expect(container.read(kalloThemeProvider), KalloPaletteId.light);
    expect(KalloPalette.currentId, KalloPaletteId.light);
  });

  testWidgets('repaints in place when the phone changes brightness — new '
      'colour, same State', (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(container: container, child: const _App()),
    );
    final before = tester.state<_ProbeState>(find.byType(_Probe));
    expect(before.painted, KalloPalette.light.surface);
    before.field.text = 'half-typed';
    final buildsBefore = before.builds;

    tester.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
    await tester.pumpAndSettle();

    expect(KalloColors.surface, KalloPalette.aurora.surface);
    final after = tester.state<_ProbeState>(find.byType(_Probe));
    expect(identical(after, before), isTrue, reason: 'State was remounted');
    expect(after.field.text, 'half-typed');
    expect(after.builds, greaterThan(buildsBefore));
    expect(after.painted, KalloPalette.aurora.surface);
    expect(
      tester.widget<ColoredBox>(find.byKey(_Probe.boxKey)).color,
      KalloPalette.aurora.surface,
    );
    final context = tester.element(find.byType(_Probe));
    expect(Theme.of(context).brightness, Brightness.dark);
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
