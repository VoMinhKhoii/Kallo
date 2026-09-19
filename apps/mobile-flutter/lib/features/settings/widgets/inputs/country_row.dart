import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';

/// One country in the [CountrySelect] popover list.
///
/// Lives in its own file because `country_select.dart` sat at 409 lines
/// against the repo's 400 hard ceiling; this was the one self-contained seam
/// in it.
///
/// Owns the selection haptic rather than leaving it to the caller's `onTap`:
/// the row is what knows whether the tap is a CHANGE, and a re-tap on the
/// country already selected should not tick.
class CountryRow extends StatefulWidget {
  const CountryRow({
    super.key,
    required this.label,
    required this.vi,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final String vi;
  final bool selected;
  final VoidCallback onTap;

  @override
  State<CountryRow> createState() => _CountryRowState();
}

class _CountryRowState extends State<CountryRow> {
  bool _pressed = false;

  void _handleTap() {
    if (!widget.selected) HapticFeedback.selectionClick();
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    final Color? bg =
        widget.selected
            ? KalloColors.accent10
            : (_pressed ? KalloColors.track : null);

    return Semantics(
      button: true,
      selected: widget.selected,
      excludeSemantics: true,
      label: '${widget.label}, ${widget.vi}',
      onTap: _handleTap,
      child: GestureDetector(
        onTap: _handleTap,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(
              KalloRadii.lg,
            ), // rounded-lg = 10
          ),
          padding: const EdgeInsets.symmetric(
            horizontal: KalloSpacing.sp3,
            vertical: KalloSpacing.sp2,
          ),
          child: Row(
            children: [
              Expanded(child: Text(widget.label, style: dashBody())),
              Text(widget.vi, style: dashMeta()),
            ],
          ),
        ),
      ),
    );
  }
}
