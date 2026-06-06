/// SectionHeader + SectionState — RN port of
/// `components/dashboard/section-header.tsx`.
library;

import 'package:flutter/material.dart';

import '../../../shared/widgets/widgets.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import 'dashboard_tokens.dart';

/// The dashboard section label: a 12px bold uppercase stone label with 0.2em
/// tracking (≈ 2.4pt @ 12px). With a [range] (or [action]) it becomes a
/// space-between row with a read-only range badge on the trailing edge.
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

  // text-xs(12) uppercase bold stone, letterSpacing 2.4.
  static final TextStyle _title =
      NhamTextStyles.sansBold(fontSize: NhamFontSize.xs)
          .copyWith(letterSpacing: 2.4, color: NhamColors.stone);

  @override
  Widget build(BuildContext context) {
    final Widget? trailing = action ??
        (range != null
            ? Text(
                range!,
                style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.xxs)
                    .copyWith(color: NhamColors.stone),
              )
            : null);

    final label = Text(title.toUpperCase(), style: _title);

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
  });

  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

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
        color: NhamColors.elev,
        borderRadius: BorderRadius.circular(kCardRadius24),
        border: Border.all(color: NhamColors.borderSoft),
        boxShadow: const [kCardShadow], // shadow-[0_10px_32px_…/0.05]
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          NhamText(
            widget.message,
            variant: NhamTextVariant.small,
            textAlign: TextAlign.center,
            style: const TextStyle(color: NhamColors.stone),
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
                  style: NhamTextStyles.sansSemiBold(fontSize: NhamFontSize.xs)
                      .copyWith(color: NhamColors.elev),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
