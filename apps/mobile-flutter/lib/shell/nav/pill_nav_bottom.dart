import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../theme/calm_tokens.dart';
import '../window/window_layout.dart';
import '../window/window_regions.dart';
import 'nav_visibility.dart';
import 'pill_nav_capsule.dart';
import 'pill_nav_veil.dart';

/// The [PillNavCapsule] floating over the bottom edge, as the Scaffold's
/// bottomNavigationBar.
///
/// On a compact phone it spans the screen less [kNavInset] either side — a
/// floating pill with fully-rounded ends, rather than a fixed 358pt island
/// with bunched targets. Wide windows cap it at 420pt, and two panes keep it
/// inside the left one.
///
/// The bar slides away while the keyboard is up. It also hides on a downward
/// scroll, returning on the first upward flick — see NavVisibility and
/// PillNavVeil.
class PillNavBottom extends ConsumerWidget {
  const PillNavBottom({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final layout = WindowLayout.of(context);
    final keyboardUp = MediaQuery.viewInsetsOf(context).bottom > 0;
    final bottomInset = layout.viewPadding.bottom;
    final regions = WindowRegions(layout);
    final leftPane = regions.paneFor(regions.safe.left);
    // Out of the way while typing, and while reading down a long branch. Both
    // hide the same way: translation, never resizing. Keep this wrapper's
    // height even when hidden: Scaffold publishes its measured height as the
    // branch's bottom scroll clearance.
    return PillNavVeil(
      hidden: keyboardUp || !ref.watch(navVisibilityProvider),
      direction: const Offset(0, 1),
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          layout.twoPane ? leftPane.left + 12 : kNavInset,
          12,
          layout.twoPane ? layout.size.width - leftPane.right + 12 : kNavInset,
          bottomInset > 0 ? bottomInset : 24,
        ),
        // heightFactor pins the bar to the pill's own height: a bare Center
        // EXPANDS to the Scaffold's bounded bottomNavigationBar constraints,
        // claiming the full screen (pill mid-screen, every extendBody tab
        // SafeArea'd to zero height — the 2026-08-31 TestFlight regression).
        child: Center(
          heightFactor: 1,
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: layout.regularWidth ? 420 : double.infinity,
            ),
            child: PillNavCapsule(
              navigationShell: navigationShell,
              axis: Axis.horizontal,
            ),
          ),
        ),
      ),
    );
  }
}
