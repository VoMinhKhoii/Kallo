import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_motion.dart';
import '../../../../theme/kallo_theme.dart';
import 'tab_faces.dart';
import 'tab_label.dart';
import 'tab_layout.dart';

/// One Circle tab: the name, and — while the tab is open — its members'
/// faces between the name and the underline, lifting the name as they come
/// in, centred in the tab's share of the row (approved canvas "E3",
/// 2026-09-29).
///
/// **It fills the size it is given** — `TabStrip` hands every tab its share
/// of the row and the row's height — and all of it is the target. A second
/// tap on the open tab is [onTap] again: the parent opens the group from it.
/// A press shrinks the block under a wash: warm on the open tab, ink on the
/// rest (mobile.md, *Press wash*).
class CircleTab extends StatefulWidget {
  const CircleTab({
    required this.label,
    required this.selected,
    required this.unread,
    required this.onTap,
    this.onLongPress,
    this.people,
    this.semanticsLabel,
    this.openHint,
    super.key,
  });

  final String label;
  final bool selected;

  /// New posts since the viewer last looked ([TabLabel] draws the dot).
  final bool unread;

  final VoidCallback onTap;

  /// Called with the tab's rect in the root overlay; null for "All". The tab
  /// stays pressed until the returned future (the menu) completes.
  final Future<void> Function(Rect anchor)? onLongPress;

  /// Who the view holds; given to the open tab only.
  final TabPeople? people;

  final String? semanticsLabel;

  /// Spoken on the open tab: what a second tap does.
  final String? openHint;

  @override
  State<CircleTab> createState() => _CircleTabState();
}

class _CircleTabState extends State<CircleTab> {
  /// A finger is on the tab. Read off the raw pointer (as `KalloPressable`
  /// does), not the tap recognizer: a long press wins the gesture arena and
  /// CANCELS the tap while the finger is still down, which dropped the wash
  /// at exactly the moment the menu was about to open.
  bool _pointerDown = false;

  /// The long-press menu is loading or open; the tab stays washed under it.
  bool _menuOpen = false;

  bool get _pressed => _pointerDown || _menuOpen;

  void _pointer(bool down) {
    if (_pointerDown != down) setState(() => _pointerDown = down);
  }

  Future<void> _longPress(Future<void> Function(Rect) onLongPress) async {
    final box = context.findRenderObject() as RenderBox?;
    final overlay =
        Overlay.of(context, rootOverlay: true).context.findRenderObject()
            as RenderBox?;
    if (box == null || overlay == null || _menuOpen) return;
    setState(() => _menuOpen = true);
    try {
      await onLongPress(
        box.localToGlobal(Offset.zero, ancestor: overlay) & box.size,
      );
    } finally {
      if (mounted) setState(() => _menuOpen = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final selected = widget.selected;
    final longPress = switch (widget.onLongPress) {
      final onLongPress? => () => _longPress(onLongPress),
      null => null,
    };
    void tap() {
      HapticFeedback.selectionClick();
      widget.onTap();
    }

    final wash = selected ? KalloColors.hover : KalloColors.pressWash;
    return Semantics(
      button: true,
      selected: selected,
      label: widget.semanticsLabel ?? widget.label,
      hint: selected ? widget.openHint : null,
      excludeSemantics: true,
      onTap: tap,
      onLongPress: longPress,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: tap,
        onLongPress: longPress,
        child: Listener(
          onPointerDown: (_) => _pointer(true),
          onPointerUp: (_) => _pointer(false),
          onPointerCancel: (_) => _pointer(false),
          // The whole share is the target; the block inside it shrinks
          // under the wash, inset a little so neighbouring washes never meet.
          child: Stack(
            fit: StackFit.expand,
            children: [
              AnimatedScale(
                scale: _pressed ? 0.97 : 1,
                duration: KalloMotion.press,
                curve: KalloEase.press,
                child: AnimatedContainer(
                  duration: KalloMotion.press,
                  margin: const EdgeInsets.fromLTRB(
                    KalloSpacing.sp1,
                    0,
                    KalloSpacing.sp1,
                    KalloSpacing.sp1,
                  ),
                  padding: const EdgeInsets.fromLTRB(
                    TabGeometry.sidePad - KalloSpacing.sp1,
                    TabGeometry.topPad,
                    TabGeometry.sidePad - KalloSpacing.sp1,
                    TabGeometry.bottomPad - KalloSpacing.sp1,
                  ),
                  alignment: Alignment.bottomCenter,
                  decoration: BoxDecoration(
                    color: _pressed ? wash : wash.withValues(alpha: 0),
                    borderRadius: BorderRadius.circular(KalloRadii.xl),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      TabLabel(
                        label: widget.label,
                        selected: selected,
                        unread: widget.unread,
                      ),
                      TabFaces(
                        label: widget.label,
                        people: selected ? widget.people : null,
                      ),
                    ],
                  ),
                ),
              ),
              // Across the tab's whole share, over the row's hairline.
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                height: 2,
                child: TweenAnimationBuilder<double>(
                  tween: Tween(end: selected ? 1 : 0),
                  duration: KalloMotion.page,
                  curve: KalloEase.decelerate,
                  builder:
                      (_, t, __) => Transform.scale(
                        scaleX: t,
                        child: const ColoredBox(color: kInk),
                      ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
