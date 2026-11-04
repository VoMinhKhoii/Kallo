/// Keeps the home-screen widget's day in step with the app, for the whole
/// session, and routes a tap on the widget to Today.
///
/// It WATCHES the two sources the Today and Log screens already read — the
/// day's saved meals ([loggingDayProvider], which every log / edit / delete /
/// refetch updates) and the profile's targets ([profileProvider], dropped by
/// every target edit) — so there is no list of call sites to remember: any
/// change to either rewrites the snapshot. Signed out, it writes the
/// signed-out card, which carries no day at all.
///
/// Mounted once, in `MaterialApp.builder` (`app.dart`) — BELOW the
/// localizations, because easy_localization's `tr()` returns the bare key
/// anywhere above them, and the widget would print `dashboard.protein`.
library;

import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../router.dart';
import '../../../services/auth/session_provider.dart';
import '../../logging/data/logging_keys.dart';
import '../../logging/data/logging_models.dart';
import '../../logging/data/logging_providers.dart';
import '../../onboarding/providers/onboarding_providers.dart';
import '../data/today_widget_store.dart';
import 'today_widget_snapshot.dart';

/// The widget's tap target (`TodayWidgetView.swift` → `widgetURL`).
bool isTodayWidgetLink(Uri uri) => uri.scheme == 'nham' && uri.host == 'today';

class TodayWidgetSync extends ConsumerStatefulWidget {
  const TodayWidgetSync({required this.child, super.key});

  final Widget child;

  @override
  ConsumerState<TodayWidgetSync> createState() => _TodayWidgetSyncState();
}

class _TodayWidgetSyncState extends ConsumerState<TodayWidgetSync>
    with WidgetsBindingObserver {
  final AppLinks _appLinks = AppLinks();
  StreamSubscription<Uri>? _links;

  /// The day the snapshot is for. Re-read on resume, so an app left open
  /// overnight writes the new day once it is back in front.
  String _today = todayDateString();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(
      _appLinks.getInitialLink().then((uri) {
        if (uri != null) _open(uri);
      }),
    );
    _links = _appLinks.uriLinkStream.listen(_open, onError: (_) {});
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _links?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) return;
    final today = todayDateString();
    if (today != _today) setState(() => _today = today);
  }

  void _open(Uri uri) {
    if (!isTodayWidgetLink(uri)) return;
    // Next frame, so the router is mounted on a cold start. Signed out, the
    // router's redirect sends this on to sign-in like any other location.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(routerProvider).go('/dashboard');
    });
  }

  @override
  Widget build(BuildContext context) {
    final snapshot = _snapshot(context.locale.toString());
    if (snapshot != null) {
      // After the frame: a write is a side effect, and the store drops a
      // snapshot identical to the last one, so rebuilds cost nothing.
      Future.microtask(() => ref.read(todayWidgetStoreProvider).save(snapshot));
    }
    // The same child instance every build, so a rebuild here never rebuilds
    // the routed app under it.
    return widget.child;
  }

  /// The day to write, or null while there is nothing settled to say.
  Map<String, Object?>? _snapshot(String locale) {
    final session = ref.watch(sessionProvider);
    if (session.isLoading) return null;
    final userId = ref.watch(signedInUserIdProvider);
    if (userId == null) {
      // Not watching the day or the profile from here on, so neither keeps
      // the account that left alive.
      return todayWidgetSignedOut(date: _today, locale: locale, tr: tr);
    }
    final day = ref.watch(loggingDayProvider(LoggingDayArgs(userId, _today)));
    final profile = ref.watch(profileProvider);
    // A failed or first load keeps whatever the widget last showed: an error
    // is not an empty day.
    final meals = day.valueOrNull?.persistedMeals;
    if (meals == null || !profile.hasValue) return null;
    return todayWidgetSnapshot(
      date: _today,
      locale: locale,
      profile: LoggingProfile.fromProfileRow(userId, profile.value?.raw),
      meals: meals,
      tr: tr,
    );
  }
}
