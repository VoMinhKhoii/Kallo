import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../services/auth/session_provider.dart';
import '../../../services/push/push_service.dart';
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
class PushRegistrationListener extends ConsumerStatefulWidget {
  const PushRegistrationListener({required this.child, super.key});

  final Widget child;

  @override
  ConsumerState<PushRegistrationListener> createState() =>
      _PushRegistrationListenerState();
}

class _PushRegistrationListenerState
    extends ConsumerState<PushRegistrationListener> {
  String? _registeredUserId;

  /// Held rather than re-read in [dispose] — `ref` is already gone by then.
  PushService? _push;

  @override
  void initState() {
    super.initState();
    // Deferred a frame so the router is mounted before a cold-start tap routes.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final container = ProviderScope.containerOf(context);
      final push = ref.read(pushServiceProvider);
      _push = push;
      push.onTap = (payload) => routePushTap(container, payload);
      unawaited(push.deliverInitialTap());
    });
  }

  @override
  void dispose() {
    _push?.onTap = null;
    super.dispose();
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
