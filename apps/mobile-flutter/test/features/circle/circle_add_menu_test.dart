import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/circle/widgets/invite/circle_add_menu.dart';

import '../../l10n_test_loader.dart';

/// The Circle header's add popover is built by `showGeneralDialog`'s
/// transitionBuilder, whose tree hangs off the Overlay — NOT off the Scaffold's
/// Material. Neither [GroupedListCard] nor [ListRow] introduces one, so the
/// menu's labels fell back to the framework's un-styled default: 48px red
/// monospace on a double YELLOW underline. A transparent Material restores the
/// inherited app style without painting anything.
Widget _app() => EasyLocalization(
      supportedLocales: const [Locale('en')],
      path: 'assets/l10n',
      fallbackLocale: const Locale('en'),
      assetLoader: const FsL10nLoader(),
      child: Builder(
        builder: (context) => MaterialApp(
          localizationsDelegates: context.localizationDelegates,
          supportedLocales: context.supportedLocales,
          locale: context.locale,
          home: const Scaffold(body: Center(child: CircleAddMenu())),
        ),
      ),
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
  });

  testWidgets('the open popover inherits the app text style, not the '
      'no-Material fallback', (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    await tester.tap(find.byType(IconButton));
    await tester.pumpAndSettle();

    final label = find.text('Create group');
    expect(label, findsOneWidget);

    // The menu must sit under a Material...
    expect(
      find.ancestor(of: label, matching: find.byType(Material)),
      findsWidgets,
      reason: 'the popover has no Material ancestor',
    );

    // ...so its labels do not inherit the framework's debug fallback style.
    final style = DefaultTextStyle.of(tester.element(label)).style;
    expect(style.decoration, isNot(TextDecoration.underline),
        reason: 'the yellow no-Material underline is showing');
    expect(style.decorationColor, isNot(const Color(0xFFFFFF00)));
  });
}
