// The surface that replaces Flutter's release-mode grey rectangle.
//
// It renders precisely when the tree is already broken, so the one thing it
// must never do is throw itself — and it must not need a theme, a locale, a
// provider or an asset to draw.
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shell/kallo_error_widget.dart';

void main() {
  FlutterErrorDetails detailsFor(Object error) =>
      FlutterErrorDetails(exception: error, library: 'test');

  testWidgets('draws with no theme, no locale and no provider above it', (
    tester,
  ) async {
    // Deliberately bare: no MaterialApp, no ProviderScope, no EasyLocalization
    // — the conditions it actually has to survive.
    await tester.pumpWidget(
      KalloErrorWidget(details: detailsFor(StateError('boom'))),
    );

    expect(tester.takeException(), isNull);
    expect(find.textContaining('Something broke'), findsOneWidget);
    // The reassurance matters as much as the diagnosis: the user's next move
    // is a restart, and they need to know it costs them nothing.
    expect(find.textContaining('Your data is safe'), findsOneWidget);
  });

  testWidgets('names the exception outside release, so a device can report it', (
    tester,
  ) async {
    await tester.pumpWidget(
      KalloErrorWidget(details: detailsFor(StateError('the cause'))),
    );

    // Tests never run in release mode, so this is the profile/debug contract:
    // the grey screen reports its own cause instead of needing a console.
    expect(kReleaseMode, isFalse);
    expect(find.textContaining('the cause'), findsOneWidget);
  });

  testWidgets('a long stack trace scrolls instead of overflowing', (
    tester,
  ) async {
    await tester.pumpWidget(
      KalloErrorWidget(
        details: detailsFor(StateError('x\n' * 400)),
      ),
    );

    // An error surface that itself overflows is how one exception becomes two.
    expect(tester.takeException(), isNull);
  });

  // `flutter_test` asserts `ErrorWidget.builder` is back to the framework's
  // own before the body returns — and it checks BEFORE `addTearDown` runs — so
  // these two restore it inline rather than on teardown.
  testWidgets('installing it replaces the framework default', (tester) async {
    final original = ErrorWidget.builder;
    installKalloErrorWidget();
    final built = ErrorWidget.builder(detailsFor(StateError('boom')));
    ErrorWidget.builder = original;

    expect(built, isA<KalloErrorWidget>());
  });

  testWidgets('a widget that throws mid-build lands on it, not on grey', (
    tester,
  ) async {
    final original = ErrorWidget.builder;
    installKalloErrorWidget();

    await tester.pumpWidget(Builder(builder: (_) => throw StateError('mid')));
    final thrown = tester.takeException();
    final landed = find.byType(KalloErrorWidget).evaluate().length;
    final named = find.textContaining('mid').evaluate().length;
    ErrorWidget.builder = original;

    expect(thrown, isStateError);
    // The whole point: a throw during build becomes a surface that NAMES the
    // cause, not Flutter's silent grey rectangle.
    expect(landed, 1);
    expect(named, 1);
  });
}
