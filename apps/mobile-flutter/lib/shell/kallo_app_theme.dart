import 'package:flutter/material.dart';

import '../theme/kallo_theme.dart';
import 'nav/swipe_back/swipe_back_transitions.dart';

/// The theme the app actually runs on: [KalloTheme.light] plus the page
/// transition the nav layer owns.
///
/// It is a function in `shell/` rather than a field on `KalloTheme` because
/// the dependency only points one way: `lib/theme/` is the bottom layer, which
/// every widget in the app imports for a spacing token, and a theme that
/// reached up into `shell/nav/` dragged the whole gesture stack in behind it
/// and left `theme -> shell -> theme` one tidy-up away.
///
/// **Use this, not `KalloTheme.light()`, for anything that mounts a
/// `MaterialApp`** — tests included. The transition is what makes the back
/// gesture work on every pushed route (`nav/swipe_back/`), so a `MaterialApp`
/// built on the bare theme silently has no swipe-back and pushes at Material's
/// 300ms instead of Cupertino's 500. `swipe_back_test.dart` asserts that
/// duration precisely so this cannot drift back unnoticed.
ThemeData kalloAppTheme() =>
    KalloTheme.light().copyWith(pageTransitionsTheme: kKalloPageTransitions);
