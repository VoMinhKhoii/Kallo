import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../router.dart';
import 'handle_validation.dart';

/// Extracts an invite slug from an inbound link, or null if it isn't one.
///
/// Handles both link shapes:
///   • custom scheme  `nham://invite/<slug>`         (host = invite)
///   • universal link `https://<domain>/<loc>/invite/<slug>` or `.../invite/<slug>`
///
/// Only a slug with the shape of a handle counts. Segments arrive
/// percent-decoded, and the slug goes straight into a route, so anything else
/// (empty, `../settings`, `a/b`) is not an invite.
@visibleForTesting
String? inviteSlugFrom(Uri uri) {
  final segments = uri.pathSegments;
  final inviteIdx = segments.indexOf('invite');
  final raw =
      inviteIdx != -1 && inviteIdx + 1 < segments.length
          ? segments[inviteIdx + 1]
          // Custom scheme: `invite` is the host, the slug the first segment.
          : uri.host == 'invite' && segments.isNotEmpty
          ? segments.first
          : null;
  // Handles are stored lowercase — normalize so a typed/QR'd uppercase link
  // still resolves instead of 404ing.
  final slug = raw?.toLowerCase();
  return slug != null && isValidHandleShape(slug) ? slug : null;
}

/// Listens for inbound invite deep links (cold-start + while-running) and routes
/// to the in-app connect screen. Wraps the app so a single listener lives for
/// the whole session. Non-invite links (e.g. Supabase's `nham://auth-callback`,
/// handled by supabase_flutter's own listener) are ignored.
class CircleDeepLinkListener extends ConsumerStatefulWidget {
  const CircleDeepLinkListener({required this.child, super.key});

  final Widget child;

  @override
  ConsumerState<CircleDeepLinkListener> createState() =>
      _CircleDeepLinkListenerState();
}

class _CircleDeepLinkListenerState
    extends ConsumerState<CircleDeepLinkListener> {
  final AppLinks _appLinks = AppLinks();
  StreamSubscription<Uri>? _sub;

  @override
  void initState() {
    super.initState();
    // Cold start: the link that launched the app (if any).
    unawaited(
      _appLinks.getInitialLink().then((uri) {
        if (uri != null) _handle(uri);
      }),
    );
    // While running: subsequent links.
    _sub = _appLinks.uriLinkStream.listen(_handle, onError: (_) {});
  }

  void _handle(Uri uri) {
    final slug = inviteSlugFrom(uri);
    if (slug == null) return;
    // Defer to the next frame so the router is mounted on a cold start.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(routerProvider).go('/circle/invite/$slug');
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
