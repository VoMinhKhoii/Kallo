import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../theme/kallo_colors.dart';
import 'nav/pill_nav_bar.dart';

/// App shell for the primary surfaces (native pass, 2026-08-31).
///
/// The web-parity hamburger + left drawer is retired — this is the sanctioned
/// divergence the redesign is built around. A floating [PillNavBar] carries
/// the four destinations plus the center "+" Add sheet; Settings pushes over
/// the shell from the dashboard avatar; the Log tab pushes the logging feed
/// full-screen (see nav/nav_actions.dart).
///
/// go_router's [StatefulNavigationShell] still backs the branches so each
/// destination keeps its state/scroll across switches. `extendBody` lets the
/// active branch draw under the floating bar while the scaffold rewrites the
/// body's `MediaQuery.padding.bottom` to clear it — scroll views that respect
/// their safe area lift above the pill for free.
class TabScaffold extends ConsumerWidget {
  const TabScaffold({required this.navigationShell, super.key});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: KalloColors.surface,
      extendBody: true,
      body: navigationShell,
      bottomNavigationBar: PillNavBar(navigationShell: navigationShell),
    );
  }
}
