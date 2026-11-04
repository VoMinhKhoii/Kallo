import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../services/auth/session_provider.dart';
import '../../../services/push/push_service.dart';
import '../../logging/data/logging_providers.dart' show invalidateMealSurfaces;
import 'push_tap_routing.dart';

/// Keeps the APNs device token in sync with the auth session, and routes taps.
///
/// Wraps the app so one registration owner lives for the whole process — the
/// same shape as `CircleDeepLinkListener`, which does this for invite links.
///
/// Registers on sign-in and on app start while signed in (a token can rotate at
/// any time, and the OS reissues it on every `registerForRemoteNotifications`).
/// Sign-out is NOT handled here: releasing the token needs the Bearer token, so
/// it runs at the sign-out call site, before the session is torn down.
///
/// Also the app's half of meal reminders: it checks in on every return to the
/// foreground — the server's "opened Kallo" signal (`PushService.checkIn`) —
/// and refreshes any day a lock-screen button closed meanwhile. The buttons'
/// titles are registered by [ReminderCategories], below the app's
/// localizations.
class PushRegistrationListener extends ConsumerStatefulWidget {
  const PushRegistrationListener({required this.child, super.key});

  final Widget child;

  @override
  ConsumerState<PushRegistrationListener> createState() =>
      _PushRegistrationListenerState();
}

class _PushRegistrationListenerState
    extends ConsumerState<PushRegistrationListener>
    with WidgetsBindingObserver {
  String? _registeredUserId;

  /// Held rather than re-read in [dispose] — `ref` is already gone by then.
  PushService? _push;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Deferred a frame so the router is mounted before a cold-start tap routes.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final container = ProviderScope.containerOf(context);
      final push = ref.read(pushServiceProvider);
      _push = push;
      push.onTap = (payload) => routePushTap(container, payload);
      // A close that finished after the resume drain (the app was opened while
      // the request was in flight) is refreshed when it lands.
      push.onDayClosed = () => unawaited(_refreshClosedDays(push));
      unawaited(push.deliverInitialTap());
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _push?.onTap = null;
    _push?.onDayClosed = null;
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      final push = ref.read(pushServiceProvider);
      unawaited(push.checkIn());
      unawaited(_refreshClosedDays(push));
    }
  }

  /// A reminder's "close the day" button runs natively while the app sits in
  /// the background, so the day it closed is refreshed here: otherwise the
  /// still-cached feed keeps offering "I've eaten enough" for it.
  Future<void> _refreshClosedDays(PushService push) async {
    final days = await push.takeClosedDays();
    final userId = _registeredUserId;
    if (!mounted || userId == null) return;
    final container = ProviderScope.containerOf(context, listen: false);
    for (final day in days) {
      invalidateMealSurfaces(container.invalidate, userId, day);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Sign-in, account switch, and sign-out all arrive here; token refreshes
    // re-emit the same user id and are ignored by [_sync].
    ref.listen(sessionProvider, (_, next) => _sync(next.valueOrNull?.user.id));
    // App start with a restored session: the stream may have already emitted
    // before this widget mounted, so seed from the resolved value once.
    _sync(ref.read(currentSessionProvider)?.user.id);
    return widget.child;
  }

  void _sync(String? userId) {
    if (userId == null) {
      // Signed out — the DELETE already ran at the sign-out call site; forget
      // the owner so the next sign-in registers again.
      _registeredUserId = null;
      return;
    }
    if (userId == _registeredUserId) return;
    _registeredUserId = userId;
    unawaited(ref.read(pushServiceProvider).registerForPush());
  }
}
