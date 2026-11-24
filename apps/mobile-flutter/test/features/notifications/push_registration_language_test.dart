import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/notifications/logic/push_registration.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:kallo_mobile/services/push/push_channel.dart';
import 'package:kallo_mobile/services/push/push_service.dart';

import '../../l10n_test_loader.dart';

/// Users saw an English reminder under Vietnamese buttons: the buttons follow
/// the app's language, the text followed an account language the app never
/// reported. The registration now carries the language picked on the phone,
/// and only a picked one: the English default must not overwrite an account.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final messenger =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;

  setUpAll(() async {
    // A phone where the person picked Vietnamese in an earlier launch.
    messenger.setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/shared_preferences'),
      (call) async =>
          call.method == 'getAll'
              ? <String, Object>{'flutter.locale': 'vi'}
              : true,
    );
    messenger.setMockMethodCallHandler(kPushMethodChannel, (_) async => null);
    await EasyLocalization.ensureInitialized();
  });

  testWidgets(
    'reports the picked language, and nothing once the pick is gone',
    (tester) async {
      final push = PushService(ApiClient());
      late BuildContext appContext;
      await tester.pumpWidget(
        EasyLocalization(
          supportedLocales: const [Locale('en'), Locale('vi')],
          path: 'assets/l10n',
          startLocale: const Locale('en'),
          fallbackLocale: const Locale('en'),
          assetLoader: const FsL10nLoader(),
          child: ProviderScope(
            overrides: [
              pushServiceProvider.overrideWithValue(push),
              sessionProvider.overrideWith((ref) => Stream.value(null)),
            ],
            child: PushRegistrationListener(
              child: Builder(
                builder: (context) {
                  appContext = context;
                  return const SizedBox();
                },
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(push.pickedLanguage?.call(), 'vi');

      // Nothing saved: the app runs the English default, which is no pick.
      await appContext.deleteSaveLocale();
      expect(push.pickedLanguage?.call(), isNull);
    },
  );
}
