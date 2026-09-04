import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../shared/data/surface_cast.dart';
import '../shared/widgets/feedback/kallo_surface_state.dart';
import '../shared/widgets/surface/kallo_primitives.dart';
import '../theme/kallo_theme.dart';
import 'header/app_header.dart';
import 'nav/nav_actions.dart';

/// What the router shows when a location does not resolve — the go_router
/// `errorBuilder`. Two things go wrong at this layer and they are not the same
/// message: an address with no screen behind it ([notFound], the seal with its
/// telescope) and a route that threw on the way in (the seal sweeping up).
///
/// Its chrome mirrors `placeholder_screen.dart`, because the same thing is
/// true of both: a deep link can land here directly, so the header must always
/// offer a way out.
class RouteErrorScreen extends StatelessWidget {
  const RouteErrorScreen({required this.notFound, super.key});

  /// Whether the router simply had no match, as opposed to a route failing.
  final bool notFound;

  @override
  Widget build(BuildContext context) {
    return Screen(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp3),
            child: AppHeader(
              onBack: () {
                if (context.canPop()) {
                  context.pop();
                } else {
                  goToLogging(context);
                }
              },
            ),
          ),
          Expanded(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(KalloSpacing.sp6),
                child: KalloSurfaceState(
                  area: SurfaceArea.system,
                  kind: notFound ? SurfaceKind.notFound : SurfaceKind.error,
                  title:
                      notFound ? tr('common.notFound') : tr('errors.route.title'),
                  subtitle: tr(
                    notFound ? 'errors.route.notFoundBody' : 'errors.route.body',
                  ),
                  action: KalloButton(
                    title: tr('errors.route.home'),
                    onPressed: () => context.go('/'),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
