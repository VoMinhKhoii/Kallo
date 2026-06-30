/// SectionHeader + SectionState — RN port of
/// `components/dashboard/section-header.tsx`.
library;

import 'package:flutter/material.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import 'dashboard_tokens.dart';

/// The dashboard section label: an 11px bold uppercase taupe eyebrow with wide
/// tracking. A [range] (or [action]) makes it a space-between row with a
/// read-only range badge (same eyebrow size, lighter weight) on the trailing
/// edge.
class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    this.range,
    this.action,
  });

  final String title;

  /// Read-only range badge (e.g. "30 days").
  final String? range;

  /// Optional trailing slot (overrides [range] when provided).
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final Widget? trailing = action ??
        (range != null
            ? Text(range!.toUpperCase(),
                style: dashEyebrow(weight: FontWeight.w500))
            : null);

    final label = Text(
      title.toUpperCase(),
      style: dashEyebrow(color: kInk),
    );

    if (trailing == null) {
      return _HeaderFadeIn(
        child: Padding(
          padding: const EdgeInsets.only(bottom: NhamSpacing.sp2),
          child: label,
        ),
      );
    }

    return _HeaderFadeIn(
      child: Padding(
        padding: const EdgeInsets.only(bottom: NhamSpacing.sp2),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [Flexible(child: label), trailing],
        ),
      ),
    );
  }
}

/// motion.div initial {opacity:0,y:6} → {1,0} over 0.5s, delay 0.1s.
class _HeaderFadeIn extends StatefulWidget {
  const _HeaderFadeIn({required this.child});
  final Widget child;

  @override
  State<_HeaderFadeIn> createState() => _HeaderFadeInState();
}

class _HeaderFadeInState extends State<_HeaderFadeIn>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 500),
  );
  late final Animation<double> _t =
      CurvedAnimation(parent: _c, curve: Curves.easeOut);

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 100), () {
      if (mounted) _c.forward();
    });
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _t,
      child: AnimatedBuilder(
        animation: _t,
        builder: (context, child) => Transform.translate(
          offset: Offset(0, 6 * (1 - _t.value)),
          child: child,
        ),
        child: widget.child,
      ),
    );
  }
}

/// The shared loading / error / empty card. Centered white card with a
/// hairline border + a stone message; an optional warm-umber pill action.
class SectionState extends StatefulWidget {
  const SectionState({
    super.key,
    required this.message,
    this.actionLabel,
    this.onAction,
    this.icon,
  });

  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  /// Optional glyph shown above the message (e.g. a cloud-off for errors).
  final IconData? icon;

  @override
  State<SectionState> createState() => _SectionStateState();
}

class _SectionStateState extends State<SectionState> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final hasAction = widget.actionLabel != null && widget.onAction != null;
    return Container(
      constraints: const BoxConstraints(minHeight: 180),
      padding: const EdgeInsets.all(NhamSpacing.sp4),
      decoration: BoxDecoration(
        color: kCardSurface,
        borderRadius: BorderRadius.circular(kCardRadius),
        boxShadow: kCardShadows, // shadow only, no border
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (widget.icon != null) ...[
            Container(
              width: 48,
              height: 48,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                color: kTrack,
                shape: BoxShape.circle,
              ),
              child: Icon(widget.icon, size: 22, color: NhamColors.stone),
            ),
            const SizedBox(height: NhamSpacing.sp3),
          ],
          Text(
            widget.message,
            textAlign: TextAlign.center,
            style: dashBody(color: kInkSecondary),
          ),
          if (hasAction) ...[
            const SizedBox(height: NhamSpacing.sp3),
            // hover:bg-nham-btn-hover — map web hover to the pressed state.
            GestureDetector(
              onTapDown: (_) => setState(() => _pressed = true),
              onTapUp: (_) => setState(() => _pressed = false),
              onTapCancel: () => setState(() => _pressed = false),
              onTap: widget.onAction,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                padding: const EdgeInsets.symmetric(
                  horizontal: NhamSpacing.sp4,
                  vertical: NhamSpacing.sp2,
                ),
                decoration: BoxDecoration(
                  color: _pressed ? NhamColors.btnHover : NhamColors.btn,
                  borderRadius: BorderRadius.circular(NhamRadii.pill),
                ),
                child: Text(
                  widget.actionLabel!,
                  // Sentence-case body label — unified with the weight-card
                  // submit button (not an 11px caps eyebrow).
                  style: dashBody(color: Colors.white, weight: FontWeight.w600),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
