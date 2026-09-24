import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_motion.dart';
import '../../../theme/kallo_theme.dart';
import '../surface/kallo_button.dart';

/// The one "save what I changed" button of an edit page, docked on the page's
/// bottom edge and present ONLY while there is something to save.
///
/// It rises in (fade + 20pt lift) the moment an edit makes the page dirty and
/// leaves the same way once the save lands — so its appearing IS the signal
/// that the page holds unsaved changes, and nothing else on the page has to
/// say it. Solid page colour with a top hairline, not a blurred card: content
/// scrolls under it, and "solid surfaces, no stacked translucency" is a system
/// rule (`kallo-design/mobile.md`).
///
/// Hand it to `ScrollSeparator.overlay`, which lays it over the body without
/// letting it drive the header's hairline. Pad the body's bottom by
/// [clearance] so the last row can scroll clear of it.
class SaveDock extends StatefulWidget {
  const SaveDock({
    super.key,
    required this.visible,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.enabled = true,
  });

  final bool visible;
  final String label;
  final VoidCallback onPressed;
  final bool loading;

  /// False while the edit is dirty but not yet savable (e.g. a metric out of
  /// range) — the dock stays, dimmed, so the page does not flicker.
  final bool enabled;

  /// The primary button's height (`KalloButton`, 50pt primaries).
  static const double buttonHeight = 50;

  /// Body bottom padding that keeps the last row clear of the dock (button +
  /// its 12pt frame), before the home-indicator inset.
  static const double clearance = buttonHeight + KalloSpacing.sp3 * 2;

  @override
  State<SaveDock> createState() => _SaveDockState();
}

class _SaveDockState extends State<SaveDock>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: KalloMotion.quick,
    value: widget.visible ? 1 : 0,
  );

  @override
  void didUpdateWidget(SaveDock old) {
    super.didUpdateWidget(old);
    if (widget.visible != old.visible) {
      widget.visible ? _c.forward() : _c.reverse();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final curved = CurvedAnimation(parent: _c, curve: KalloEase.decelerate);
    return Align(
      alignment: Alignment.bottomCenter,
      child: IgnorePointer(
        ignoring: !widget.visible,
        child: FadeTransition(
          opacity: curved,
          child: SlideTransition(
            position: Tween(
              begin: const Offset(0, 0.25),
              end: Offset.zero,
            ).animate(curved),
            child: DecoratedBox(
              decoration: const BoxDecoration(
                color: kPage,
                border: Border(top: BorderSide(color: kHairline)),
              ),
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  KalloSpacing.sp3,
                  KalloSpacing.sp3,
                  KalloSpacing.sp3,
                  KalloSpacing.sp3 + MediaQuery.viewPaddingOf(context).bottom,
                ),
                // A FIXED box: KalloButton centres its label with a Container
                // alignment, which grows to any finite height it is offered —
                // under this Align it would take the whole page.
                child: SizedBox(
                  width: double.infinity,
                  height: SaveDock.buttonHeight,
                  child: KalloButton(
                    title: widget.label,
                    loading: widget.loading,
                    disabled: !widget.enabled,
                    onPressed: widget.onPressed,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
