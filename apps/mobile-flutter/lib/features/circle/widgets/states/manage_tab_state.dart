import 'package:flutter/widgets.dart';

/// An empty or error state that owns a whole tab of the "Edit circle" page:
/// centred in the tab's own height, and still scrollable so a large Dynamic
/// Type size or a short phone can reach its action.
///
/// The tab's height is this state's OWN space — the header and tab bar above
/// it are fixed — which is what `KalloSurfaceState.minHeight` asks for.
class ManageTabState extends StatelessWidget {
  const ManageTabState({super.key, required this.builder});

  /// Builds the state for the tab's height (hand it to
  /// `KalloSurfaceState.minHeight`).
  final Widget Function(double height) builder;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder:
        (context, box) => SingleChildScrollView(child: builder(box.maxHeight)),
  );
}
