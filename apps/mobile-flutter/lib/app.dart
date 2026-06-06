import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'router.dart';
import 'theme/nham_theme.dart';

/// Root app widget — ported from the RN `RootLayout` (`app/_layout.tsx`).
///
/// Wires the Nham [ThemeData], the Riverpod-built [GoRouter], and
/// easy_localization's delegates/locale (EasyLocalization already wraps this
/// in `main()`, the equivalent of RN's `LocaleProvider`). The status-bar style
/// is forced dark-content to match RN's `<StatusBar style="dark" />` on the
/// cream surface.
class NhamApp extends ConsumerWidget {
  const NhamApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'Nhẩm',
      debugShowCheckedModeBanner: false,
      theme: NhamTheme.light(),
      routerConfig: router,
      // easy_localization wiring (locale source of truth lives on the
      // EasyLocalization wrapper in main()).
      localizationsDelegates: context.localizationDelegates,
      supportedLocales: context.supportedLocales,
      locale: context.locale,
    );
  }
}
