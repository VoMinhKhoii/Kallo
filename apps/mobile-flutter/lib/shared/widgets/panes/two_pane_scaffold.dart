import 'package:flutter/widgets.dart';

import '../../../shell/window/window_layout.dart';
import '../../../shell/window/window_regions.dart';
import '../surface/scroll_separator.dart';

/// The fold is empty space, while each pane owns its own scroll hairline.
/// Screens supply scroll views and retain their controllers above this frame.
class TwoPaneScaffold extends StatelessWidget {
  const TwoPaneScaffold({
    super.key,
    required this.header,
    required this.far,
    required this.near,
  });
  final Widget header;
  final Widget far;
  final Widget near;

  @override
  Widget build(BuildContext context) {
    final layout = WindowLayout.of(context);
    final regions = WindowRegions(layout);
    final left = regions.paneFor(regions.safe.left);
    final right = regions.paneFor(regions.safe.right);
    final nearLeft = layout.nearLeft;
    return Column(
      children: [
        header,
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
