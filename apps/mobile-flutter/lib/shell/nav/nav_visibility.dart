import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Whether the pill nav is currently hidden by a downward scroll.
///
/// Written by [TabScaffold]'s `UserScrollNotification` listener and read by
/// [PillNavBar], which hands it to `PillNavVeil`.
///
/// THE RESIZE HAZARD: the bar is the Scaffold's `bottomNavigationBar` under
/// `extendBody`, so its LAID-OUT height is what Flutter reports to every tab
/// body as `MediaQuery.padding.bottom` (see `kallo_screen.dart` and
/// `kallo_refresh.dart`, and the `nav_clearance_test` that pins it). Hiding
/// the bar must therefore TRANSLATE it — never shrink, replace or remove it.
/// Collapsing it to a zero-size box would republish a bottom inset of 0 to
/// every scroll view mid-scroll and jump the content under the user's finger.
final navHiddenProvider = StateProvider<bool>((ref) => false);
