import 'package:flutter/foundation.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';

import 'launch_painter.dart';
import 'launch_timeline.dart';

/// The launch intro, laid over the app for its first moments.
///
/// Its first frame is the native launch screen redrawn exactly — the ink K,
/// centred, on the app canvas — so the fade from the iOS storyboard to
/// Flutter cannot be seen. Then the K backs up to the left and "allo" rolls
/// in from the right as a little train that clacks into it (`ClackIntro`);
/// once the app underneath is [ready], the word lifts and fades and the
/// canvas clears onto the app (`LiftReveal`), and the curtain removes itself.
///
/// The app routes, builds and fetches underneath from the first frame, so the
/// intro spends load time rather than adding to it. It plays once per
/// process: the curtain sits above the router, so a warm resume or a
/// navigation never sees it again. While it is up it swallows taps and hides
/// the app from assistive technology; Reduce Motion swaps the choreography
/// for a crossfade.
class LaunchCurtain extends StatefulWidget {
  const LaunchCurtain({required this.ready, required this.child, super.key});

  /// True once the app underneath may be seen. The reveal never starts
  /// before it is, however long that takes.
  final ValueListenable<bool> ready;

  /// The app.
  final Widget child;

  @override
  State<LaunchCurtain> createState() => _LaunchCurtainState();
}

class _LaunchCurtainState extends State<LaunchCurtain>
    with SingleTickerProviderStateMixin {
  final LaunchClock _clock = LaunchClock();
  late final Ticker _ticker = createTicker(_onTick);
  LaunchTimeline? _timeline;
  bool _done = false;

  @override
  void initState() {
    super.initState();
    widget.ready.addListener(_onReady);
    _onReady();
    _ticker.start();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Decided once: flipping the setting mid-intro should not restart it.
    _timeline ??= LaunchTimeline(
      reduceMotion: MediaQuery.disableAnimationsOf(context),
    );
  }

  @override
  void didUpdateWidget(LaunchCurtain oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.ready == widget.ready) return;
    oldWidget.ready.removeListener(_onReady);
    widget.ready.addListener(_onReady);
    _onReady();
  }

  void _onReady() {
    if (widget.ready.value) _clock.markReady();
  }

  void _onTick(Duration elapsed) {
    _clock.tick(elapsed.inMicroseconds / 1000);
    if (!_timeline!.isDone(_clock.elapsed, _clock.readyAt)) return;
    _ticker.stop();
    widget.ready.removeListener(_onReady);
    setState(() => _done = true);
  }

  @override
  void dispose() {
    widget.ready.removeListener(_onReady);
    _ticker.dispose();
    _clock.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // The app stays the first child whether or not the curtain is up, so
    // taking the curtain away never remounts the app underneath it.
    return Stack(
      fit: StackFit.expand,
      children: [
        widget.child,
        if (!_done)
          AbsorbPointer(
            child: BlockSemantics(
              child: Semantics(
                label: 'Kallo',
                image: true,
                child: RepaintBoundary(
                  child: CustomPaint(
                    painter: LaunchPainter(clock: _clock, timeline: _timeline!),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
