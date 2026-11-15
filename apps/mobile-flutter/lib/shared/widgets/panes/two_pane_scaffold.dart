import 'package:flutter/widgets.dart';

import '../../../shell/window/window_layout.dart';
import '../../../shell/window/window_regions.dart';
import '../surface/scroll_separator.dart';

/// The fold is empty space, while each pane owns its own scroll hairline.
/// Screens supply scroll views and retain their state above this frame
/// ([PaneScroll] for a refreshable pane).
///
/// A one-column window shows [single], so the caller does not branch on the
/// window itself. [single] is null only for a frame its caller mounts in
/// two-pane windows alone: the Log's loading silhouette sits inside its own
/// `Screen`, and the one-column silhouette is a different screen.
class TwoPaneScaffold extends StatelessWidget {
  const TwoPaneScaffold({
    super.key,
    this.header,
    required this.far,
    required this.near,
    required this.single,
  });
  final Widget? header;
  final Widget far;
  final Widget near;
  final Widget? single;

  @override
  Widget build(BuildContext context) {
    final layout = WindowLayout.of(context);
    assert(
      single != null || layout.twoPane,
      'A TwoPaneScaffold without a single child was mounted in one column.',
    );
    if (!layout.twoPane && single != null) return single!;
    final regions = WindowRegions(layout);
    final left = regions.paneFor(regions.safe.left);
    final right = regions.paneFor(regions.safe.right);
    final nearLeft = layout.nearLeft;
    return Column(
      children: [
        if (header != null) header!,
        Expanded(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                width: left.width,
                child: ClipRect(
                  child: ScrollSeparator(
                    overlayHairline: true,
                    header: const SizedBox.shrink(),
                    child: nearLeft ? near : far,
                  ),
                ),
              ),
              const SizedBox(width: kFoldGutter),
              SizedBox(
                width: right.width,
                child: ClipRect(
                  child: ScrollSeparator(
                    overlayHairline: true,
                    header: const SizedBox.shrink(),
                    child: nearLeft ? far : near,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
