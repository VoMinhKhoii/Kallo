import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';

import '../../../../../../theme/kallo_motion.dart';
import 'switch_veil.dart';

/// A live preview that fades up once [isReady] rather than popping in — the
/// second half of [ScanCameraVeil]'s dip. [source] says when to ask again.
///
/// Stateful rather than a `ValueListenableBuilder` because mobile_scanner
/// starts its controller from its own `initState` and notifies right there,
/// mid-build; a builder listening ABOVE the scanner is then marked dirty
/// during build, which asserts. A change heard mid-build waits for the frame.
class ScanPreviewFadeIn extends StatefulWidget {
  const ScanPreviewFadeIn({
    super.key,
    required this.source,
    required this.isReady,
    required this.child,
  });

  final Listenable source;
  final bool Function() isReady;
  final Widget child;

  @override
  State<ScanPreviewFadeIn> createState() => _ScanPreviewFadeInState();
}

class _ScanPreviewFadeInState extends State<ScanPreviewFadeIn> {
  late bool _ready = widget.isReady();

  @override
  void initState() {
    super.initState();
    widget.source.addListener(_changed);
  }

  @override
  void didUpdateWidget(ScanPreviewFadeIn oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.source != widget.source) {
      oldWidget.source.removeListener(_changed);
      widget.source.addListener(_changed);
    }
    _ready = widget.isReady();
  }

  @override
  void dispose() {
    widget.source.removeListener(_changed);
    super.dispose();
  }

  void _changed() {
    final scheduler = SchedulerBinding.instance;
    if (scheduler.schedulerPhase == SchedulerPhase.persistentCallbacks) {
      scheduler.addPostFrameCallback((_) => _changed());
      return;
    }
    if (!mounted) return;
    final ready = widget.isReady();
    if (ready != _ready) setState(() => _ready = ready);
  }

  @override
  Widget build(BuildContext context) => AnimatedOpacity(
    opacity: _ready ? 1 : 0,
    duration: kScanCameraFade,
    curve: KalloEase.enter,
    child: widget.child,
  );
}
