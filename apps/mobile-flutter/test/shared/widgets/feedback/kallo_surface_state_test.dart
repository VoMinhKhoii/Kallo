import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/data/surface_cast.dart';
import 'package:kallo_mobile/shared/widgets/feedback/kallo_surface_state.dart';
import 'package:kallo_mobile/shared/widgets/surface/kallo_primitives.dart';

/// Plain strings, no l10n: this is the anatomy under test — the art's size, the
/// pose the clock picks, and whether the surface announces itself — not copy.
Widget _app(Widget child) => MaterialApp(
  home: Scaffold(body: Center(child: child)),
);

/// The SVG decodes off the main isolate, so the picture only sizes itself once
/// real async work has run.
Future<void> _pumpArt(WidgetTester tester, Widget child) async {
  await tester.pumpWidget(_app(child));
  await tester.runAsync(() async {
    await Future<void>.delayed(const Duration(milliseconds: 100));
  });
  await tester.pumpAndSettle();
}

String _assetName(WidgetTester tester) {
  final svg = tester.widget<SvgPicture>(find.byType(SvgPicture));
  return (svg.bytesLoader as SvgAssetLoader).assetName;
}

void main() {
  testWidgets('renders title, subtitle and the action', (tester) async {
    await _pumpArt(
      tester,
      KalloSurfaceState(
        area: SurfaceArea.circle,
        kind: SurfaceKind.empty,
        title: 'Just you so far',
        subtitle: 'Invite a friend and this fills up.',
        action: KalloButton(title: 'Invite', onPressed: () {}),
      ),
    );

    expect(find.text('Just you so far'), findsOneWidget);
    expect(find.text('Invite a friend and this fills up.'), findsOneWidget);
    expect(find.byType(KalloButton), findsOneWidget);
  });

  testWidgets('stands the art 120 tall, 64 when compact, width from the '
      'viewBox', (tester) async {
    await _pumpArt(
      tester,
      const KalloSurfaceState(
        area: SurfaceArea.nutrition,
        kind: SurfaceKind.empty,
        title: 'Nothing logged yet',
      ),
    );
    final full = tester.getSize(find.byType(SvgPicture));
    expect(full.height, 120);
    expect(full.width, greaterThan(0));

    await _pumpArt(
      tester,
      const KalloSurfaceState(
        area: SurfaceArea.nutrition,
        kind: SurfaceKind.empty,
        title: 'Nothing logged yet',
        compact: true,
      ),
    );
    final compact = tester.getSize(find.byType(SvgPicture));
    expect(compact.height, 64);
    expect(compact.width, greaterThan(0));
  });

  testWidgets('sleeps after 22:00 and works by day', (tester) async {
    await _pumpArt(
      tester,
      KalloSurfaceState(
        area: SurfaceArea.circle,
        kind: SurfaceKind.error,
        title: 'This did not load',
        now: () => DateTime(2026, 9, 4, 23),
      ),
    );
    expect(_assetName(tester), contains('capybara-sleeping-hammock'));

    await _pumpArt(
      tester,
      KalloSurfaceState(
        area: SurfaceArea.circle,
        kind: SurfaceKind.error,
        title: 'This did not load',
        now: () => DateTime(2026, 9, 4, 12),
      ),
    );
    expect(_assetName(tester), contains('capybara-stuck-jar'));
  });

  testWidgets('announces an error as a live region, an empty state not',
      (tester) async {
    await _pumpArt(
      tester,
      const KalloSurfaceState(
        area: SurfaceArea.dashboard,
        kind: SurfaceKind.error,
        title: 'This did not load',
      ),
    );
    expect(
      tester
          .getSemantics(find.byType(KalloSurfaceState))
          .flagsCollection
          .isLiveRegion,
      isTrue,
    );

    await _pumpArt(
      tester,
      const KalloSurfaceState(
        area: SurfaceArea.dashboard,
        kind: SurfaceKind.empty,
        title: 'Nothing here yet',
      ),
    );
    expect(
      tester
          .getSemantics(find.byType(KalloSurfaceState))
          .flagsCollection
          .isLiveRegion,
      isFalse,
    );
  });
}
