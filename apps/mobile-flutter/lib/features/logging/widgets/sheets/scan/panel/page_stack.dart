import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import '../../../../../../theme/kallo_motion.dart';
import 'scope.dart';
import 'swap_layout.dart';

/// One page of the scan sheet. [key] names it — a new key is a new page —
/// and [level] says which way a change travels: deeper (the editor, the
/// other nutrients) pushes in from the right, shallower pops back from the
/// left, level with it crossfades.
class ScanSheetPage {
  const ScanSheetPage({
    required this.key,
    required this.level,
    required this.child,
  });

  final Key key;
  final int level;
  final Widget child;
}

/// The sheet's pages: one at rest, two while one gives way to the next. The
/// sheet around them stays put — a change of page is the content travelling,
/// never the sheet going down and a new one coming up.
///
/// A page keeps its state for the length of its exit — it is the same element
/// in both slots, matched by its key — so the editor slides out holding what
/// was typed, not the values it opened with.
class ScanPageStack extends StatefulWidget {
  const ScanPageStack({
    super.key,
    required this.page,
    required this.callbacks,
    required this.dragDx,
  });

  final ScanSheetPage page;

  /// The live set the showing page registers into.
  final ScanSheetCallbacks callbacks;

  /// The sheet's drag; its `dx` is how far a swipe back has carried the
  /// showing page to the right.
  final ValueListenable<Offset> dragDx;

  @override
  State<ScanPageStack> createState() => ScanPageStackState();
}

class ScanPageStackState extends State<ScanPageStack>
    with SingleTickerProviderStateMixin {
  /// Rests at 1: a page that never swapped sits at the end of its entrance.
  late final AnimationController _swap = AnimationController(
    vsync: this,
    duration: KalloMotion.page,
    value: 1,
  )..addStatusListener(_onStatus);

  ScanSheetPage? _outgoing;
  final ScanSheetCallbacks _detached = ScanSheetCallbacks();

  /// +1 push, -1 pop, 0 crossfade.
  int _direction = 0;

  /// Where the swap starts: 0, or how far a released swipe back had already
  /// carried the page, so the pop carries on from the finger instead of
  /// jumping back to the start.
  double _from = 0;
  double? _handoff;

  /// A swipe back is about to pop: start the pop from [progress] (0 → 1 of
  /// the width). Forgotten after a frame if no pop comes.
  void handOff(double progress) {
    _handoff = progress;
    WidgetsBinding.instance.addPostFrameCallback((_) => _handoff = null);
  }

  void _onStatus(AnimationStatus status) {
    if (status == AnimationStatus.completed && _outgoing != null) {
      setState(() => _outgoing = null);
    }
  }

  @override
  void didUpdateWidget(ScanPageStack oldWidget) {
    super.didUpdateWidget(oldWidget);
    final before = oldWidget.page;
    if (before.key == widget.page.key) return;
    // The field being typed in belongs to the page leaving.
    FocusManager.instance.primaryFocus?.unfocus();
    _outgoing = before;
    _direction = (widget.page.level - before.level).sign;
    _from = _direction < 0 ? (_handoff ?? 0) : 0;
    _handoff = null;
    _swap.forward(from: 0);
  }

  @override
  void dispose() {
    _swap.dispose();
    super.dispose();
  }

  /// The swap's progress, eased, from where it was handed off.
  double get _t =>
      _from + (1 - _from) * KalloEase.decelerate.transform(_swap.value);

  /// One page in its slot. The SAME shape in or out, at rest or moving —
  /// only values change — so a page's element, and its state, carries from
  /// the incoming slot to the outgoing one.
  Widget _slot(
    ScanSheetPage page, {
    required bool incoming,
    required double t,
  }) {
    final swapping = _outgoing != null;
    final travel = incoming ? _direction * (1 - t) : -_direction * t;
    final fade = swapping && _direction == 0;
    return KeyedSubtree(
      key: page.key,
      child: IgnorePointer(
        ignoring: !incoming,
        child: ExcludeSemantics(
          excluding: !incoming,
          child: Transform.translate(
            offset: Offset(incoming ? widget.dragDx.value.dx : 0, 0),
            child: FractionalTranslation(
              translation: Offset(travel.toDouble(), 0),
              child: Opacity(
                opacity: fade ? (incoming ? t : 1 - t) : 1,
                child: ScanSheetScope(
                  callbacks: incoming ? widget.callbacks : _detached,
                  child: page.child,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: Listenable.merge([_swap, widget.dragDx]),
    builder: (context, _) {
      final outgoing = _outgoing;
      final t = outgoing == null ? 1.0 : _t;
      return ScanSwapLayout(
        t: t,
        children: [
          if (outgoing != null) _slot(outgoing, incoming: false, t: t),
          _slot(widget.page, incoming: true, t: t),
        ],
      );
    },
  );
}
