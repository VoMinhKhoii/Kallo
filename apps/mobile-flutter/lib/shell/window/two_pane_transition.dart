import 'package:flutter/widgets.dart';

import 'window_layout.dart';

/// Lets a screen act when its window changes between one column and two
/// panes, after the frame that made the change rather than in the middle of
/// building it.
///
/// A side effect started from build ran while the tree was half built: a
/// notifier written there told its listeners mid-build, and each screen kept
/// its own "was it two panes last time" field to notice the change at all.
/// This keeps that field once, updated where the layout dependency is read.
mixin TwoPaneTransition<T extends StatefulWidget> on State<T> {
  // A screen starts as one column, so mounting in a two-pane window counts as
  // a change into two panes.
  bool _wasTwoPane = false;

  /// Runs after the frame in which [WindowLayout.twoPane] changed. The window
  /// is now the other arrangement from [wasTwoPane].
  void onTwoPaneChanged(bool wasTwoPane);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final twoPane = WindowLayout.of(context).twoPane;
    if (twoPane == _wasTwoPane) return;
    final wasTwoPane = _wasTwoPane;
    _wasTwoPane = twoPane;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) onTwoPaneChanged(wasTwoPane);
    });
  }
}
