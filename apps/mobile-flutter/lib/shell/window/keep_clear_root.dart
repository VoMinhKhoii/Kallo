import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';

/// The box a column-free page measures its pieces against: the page itself,
/// which sits on the window when it is at rest. Measuring against the page
/// rather than the screen keeps a route's slide-in transition out of the
/// sums.
class KeepClearRoot extends SingleChildRenderObjectWidget {
  const KeepClearRoot({super.key, required Widget super.child});

  @override
  RenderKeepClearRoot createRenderObject(BuildContext context) =>
      RenderKeepClearRoot();
}

class RenderKeepClearRoot extends RenderProxyBox {
  /// The nearest root above [node], or null off a column-free page.
  static RenderKeepClearRoot? above(RenderObject node) {
    var parent = node.parent;
    while (parent != null && parent is! RenderKeepClearRoot) {
      parent = parent.parent;
    }
    return parent as RenderKeepClearRoot?;
  }
}
