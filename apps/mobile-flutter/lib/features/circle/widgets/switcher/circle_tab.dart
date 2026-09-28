import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../models/social/circle.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_motion.dart';
import '../../../../theme/kallo_theme.dart';
import 'tab_faces.dart';

/// One Circle tab: the name, and — while the tab is open — its members'
/// faces between the name and the underline, lifting the name as they come
/// in (approved canvas "E2", 2026-09-29).
///
/// **The whole column is the target.** 72pt tall, and [slop] points of it
/// reach into the gap on each side, so neighbouring tabs meet with no dead
/// strip between them. A second tap on the open tab — name, faces or the air
/// around them — is [onTap] again; the parent opens the group from it. The
/// press shows as the block shrinking a touch under a wash: the warm select
/// wash on the open tab, the ink press wash on the rest (mobile.md, *Press
/// wash*).
class CircleTab extends StatefulWidget {
  const CircleTab({
    required this.label,
    required this.selected,
    required this.unread,
    required this.onTap,
    this.onLongPress,
    this.faces = const [],
    this.total = 0,
    this.semanticsLabel,
    this.openHint,
    super.key,
  });

  final String label;
  final bool selected;

  /// New posts since the viewer last looked. Not drawn on the open tab — the
  /// viewer is reading it.
  final bool unread;

  final VoidCallback onTap;

  /// Called with the tab's rect in the root overlay; null for "All".
  final ValueChanged<Rect>? onLongPress;

  /// The members to show while open, and how many there are in all.
  final List<CircleProfile> faces;
  final int total;

  final String? semanticsLabel;

  /// Spoken on the open tab: what a second tap does.
  final String? openHint;

  static const double height = 72;

  /// Of the tab's side padding, how much reaches past the pressed block.
  static const double slop = 2;

  @override
  State<CircleTab> createState() => _CircleTabState();
}

class _CircleTabState extends State<CircleTab> {
  bool _pressed = false;

  void _press(bool down) {
    if (_pressed != down) setState(() => _pressed = down);
  }

  void _longPress() {
    final box = context.findRenderObject() as RenderBox?;
    final overlay =
        Overlay.of(context, rootOverlay: true).context.findRenderObject()
            as RenderBox?;
    if (box == null || overlay == null) return;
    widget.onLongPress!(
      box.localToGlobal(Offset.zero, ancestor: overlay) & box.size,
    );
  }

  @override
  Widget build(BuildContext context) {
    final selected = widget.selected;
    final wash = selected ? KalloColors.hover : KalloColors.pressWash;
    final name = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedDefaultTextStyle(
          duration: KalloMotion.quick,
          style: dashBody(color: selected ? kInk : kInkMuted),
          child: Text(widget.label, maxLines: 1),
        ),
        if (widget.unread && !selected) ...[
          const SizedBox(width: KalloSpacing.sp1),
          const DecoratedBox(
            key: Key('circle-unread-dot'),
            decoration: BoxDecoration(color: kInk, shape: BoxShape.circle),
            child: SizedBox.square(dimension: 7),
          ),
        ],
      ],
    );
    return Semantics(
      button: true,
      selected: selected,
      label: widget.semanticsLabel ?? widget.label,
      hint: selected ? widget.openHint : null,
      excludeSemantics: true,
      onLongPress: widget.onLongPress == null ? null : _longPress,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          HapticFeedback.selectionClick();
          widget.onTap();
        },
        onLongPress: widget.onLongPress == null ? null : _longPress,
        onTapDown: (_) => _press(true),
        onTapUp: (_) => _press(false),
        onTapCancel: () => _press(false),
        child: SizedBox(
          height: CircleTab.height,
          child: Stack(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  CircleTab.slop,
                  0,
                  CircleTab.slop,
                  KalloSpacing.sp1,
                ),
                child: Align(
                  alignment: Alignment.bottomLeft,
                  widthFactor: 1,
                  child: AnimatedScale(
                    scale: _pressed ? 0.97 : 1,
                    duration: KalloMotion.press,
                    curve: KalloEase.press,
                    child: AnimatedContainer(
                      duration: KalloMotion.press,
                      padding: const EdgeInsets.symmetric(
                        horizontal: KalloSpacing.sp2,
                        vertical: KalloSpacing.sp1_5,
                      ),
                      decoration: BoxDecoration(
                        color: _pressed ? wash : wash.withValues(alpha: 0),
                        borderRadius: BorderRadius.circular(KalloRadii.xl),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          name,
                          TabFaces(
                            open: selected,
                            label: widget.label,
                            faces: widget.faces,
                            total: widget.total,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              Positioned(
                left: CircleTab.slop + KalloSpacing.sp2,
                right: CircleTab.slop + KalloSpacing.sp2,
                bottom: 0,
                child: TweenAnimationBuilder<double>(
                  tween: Tween(end: selected ? 1 : 0),
                  duration: KalloMotion.page,
                  curve: KalloEase.decelerate,
                  builder:
                      (_, t, __) => Transform.scale(
                        scaleX: t,
                        child: Container(height: 2, color: kInk),
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
