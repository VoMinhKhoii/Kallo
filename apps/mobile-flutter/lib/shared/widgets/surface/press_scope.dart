import 'package:flutter/gestures.dart';
import 'package:flutter/widgets.dart';

/// `KalloPressable`'s nesting protocol — not a widget anyone else builds.
///
/// A pressable inside another pressable washes ALONE: the innermost one under
/// the finger takes the wash and every ancestor stays clear. A Circle post is
/// the tap target for its own thread (Threads anatomy) while its heart, reply
/// and copy glyphs are targets of their own, so without this rule a tap on the
/// heart flashed the whole post behind it.
///
/// The mechanism: on pointer-down the inner target CLAIMS its pointer up the
/// chain of scopes before washing, and a target whose own pointer is already
/// claimed skips its wash. That ordering works because Flutter dispatches a
/// pointer to the hit-test path INNERMOST FIRST — `RenderBox.hitTest` adds its
/// children to the path before itself, and `GestureBinding.dispatchEvent`
/// walks that path in order. Verified by test ("a nested pressable washes
/// alone").
///
/// Exposed by every pressable over its own subtree, so a claim walks the whole
/// chain rather than only one level.
class PressScope extends InheritedWidget {
  const PressScope({required this.claim, required super.child, super.key});

  /// "This pointer belongs to a target below you — do not wash for it."
  final void Function(int pointer) claim;

  static PressScope? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<PressScope>();

  @override
  bool updateShouldNotify(PressScope oldWidget) => oldWidget.claim != claim;
}

/// One target's side of the protocol: whose pointer is whose.
///
/// Kept apart from the widget because it is pure bookkeeping — it decides, and
/// the widget paints. Every answer is "should I change my wash?", so the
/// pressable's own state stays a single bool.
class PressClaims {
  /// The scope of the nearest pressable ABOVE the owner — set from its
  /// `didChangeDependencies`, since the owner's own scope is a descendant and
  /// would otherwise resolve to itself.
  PressScope? parent;

  /// Pointers a target below the owner has claimed, and which the owner must
  /// therefore ignore. A Set rather than a single id because a second finger
  /// may land elsewhere in the same subtree.
  final Set<int> _claimed = <int>{};

  /// The finger the wash belongs to, and where it went down so a move can be
  /// measured against it — ONE value, since the two are set and cleared
  /// together and neither means anything without the other. The slop is part
  /// of "is this still a press?", which is this class' whole question, and the
  /// pointer id is what keeps a SECOND finger landing and lifting elsewhere on
  /// the same target from clearing the first finger's wash (2026-09-08).
  ({int pointer, Offset origin})? _press;

  /// A descendant's claim, forwarded on so an ancestor two levels up stays
  /// clear as well.
  void claim(int pointer) {
    _claimed.add(pointer);
    parent?.claim(pointer);
  }

  /// A pointer went down on the owner at [position] (global — the same frame
  /// [moved] reads, so the two compare). Claims it up the chain — disabled or
  /// not, because a disabled control is still a control and the target
  /// underneath it may not have the press — and answers whether the owner
  /// should now wash.
  ///
  /// Claiming happens FIRST: this runs before every ancestor's, so they read
  /// the claim when their own turn comes.
  bool press(int pointer, Offset position, {required bool enabled}) {
    parent?.claim(pointer);
    if (!enabled || _claimed.contains(pointer)) return false;
    // A finger is already washing this target; the wash stays that finger's.
    if (_press != null) return false;
    _press = (pointer: pointer, origin: position);
    return true;
  }

  /// The pressing finger moved. Answers whether the wash is over: past
  /// [kTouchSlop] from where it landed the finger is SCROLLING, not pressing,
  /// and nothing else would clear the wash — the pointer does not lift until
  /// the drag ends, so a flick down the feed left the post it started on grey
  /// for the whole gesture (2026-09-08).
  ///
  /// The claim is deliberately NOT dropped: the pointer still belongs to this
  /// target, so no ancestor may light up in its place. Only the wash ends.
  bool moved(int pointer, Offset position) {
    final press = _press;
    if (press == null || pointer != press.pointer) return false;
    if ((position - press.origin).distance <= kTouchSlop) return false;
    _press = null;
    return true;
  }

  /// A pointer lifted or was cancelled. Drops its claim whichever finger it
  /// is, and answers whether the wash it owned is over.
  bool release(int pointer) {
    _claimed.remove(pointer);
    if (pointer != _press?.pointer) return false;
    _press = null;
    return true;
  }
}
