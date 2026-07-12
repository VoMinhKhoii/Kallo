import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';

/// A single subscription package card — plan name, live store price, an
/// optional "best value" flag, and a tap-to-purchase affordance (with a busy
/// spinner while its purchase is in flight).
///
/// Prices come straight from the store via [Package.storeProduct.priceString]
/// (already localized + currency-formatted by the platform).
class PackageCard extends StatefulWidget {
  const PackageCard({
    super.key,
    required this.package,
    required this.ctaLabel,
    required this.onTap,
    this.busy = false,
    this.enabled = true,
  });

  final Package package;
  final String ctaLabel;
  final VoidCallback onTap;
  final bool busy;
  final bool enabled;

  @override
  State<PackageCard> createState() => _PackageCardState();
}

class _PackageCardState extends State<PackageCard> {
  bool _pressed = false;

  bool get _interactive => widget.enabled && !widget.busy;

  /// Human label for the plan cadence from the RC package type.
  String get _planLabel => switch (widget.package.packageType) {
    PackageType.annual => tr('paywall.packageAnnual'),
    PackageType.lifetime => tr('paywall.packageLifetime'),
    PackageType.monthly => tr('paywall.packageMonthly'),
    _ => widget.package.storeProduct.title,
  };

  /// Per-period suffix (/mo, /yr) — omitted for lifetime / unknown.
  String? get _priceSuffix => switch (widget.package.packageType) {
    PackageType.monthly => tr('paywall.perMonth'),
    PackageType.annual => tr('paywall.perYear'),
    _ => null,
  };

  /// Highlight annual + lifetime as the value plays.
  bool get _bestValue =>
      widget.package.packageType == PackageType.annual ||
      widget.package.packageType == PackageType.lifetime;

  @override
  Widget build(BuildContext context) {
    final priceString = widget.package.storeProduct.priceString;
    final suffix = _priceSuffix;
    final highlight = _bestValue;

    final content = Container(
      padding: const EdgeInsets.symmetric(
        horizontal: NhamSpacing.sp4,
        vertical: NhamSpacing.sp4,
      ),
      decoration: BoxDecoration(
        color: _pressed ? NhamColors.accent10 : NhamColors.elev,
        borderRadius: BorderRadius.circular(NhamRadii.xxl),
        border: Border.all(
          color:
              highlight ? NhamColors.accentSelectedBorder : NhamColors.border,
          width: highlight ? 1.5 : 1,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(_planLabel, style: dashBody(weight: FontWeight.w500)),
                    if (highlight) ...[
                      const SizedBox(width: NhamSpacing.sp2),
                      _BestValueTag(),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Text(widget.ctaLabel, style: dashMeta()),
              ],
            ),
          ),
          if (widget.busy)
            const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation(NhamColors.accent),
              ),
            )
          else
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(priceString, style: dashValue()),
                if (suffix != null) Text(suffix, style: dashMeta()),
              ],
            ),
        ],
      ),
    );

    return Opacity(
      opacity: widget.enabled ? 1.0 : 0.5,
      child: Semantics(
        button: true,
        enabled: widget.enabled,
        excludeSemantics: true,
        label: '$_planLabel, $priceString',
        onTap: _interactive ? widget.onTap : null,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown:
              _interactive ? (_) => setState(() => _pressed = true) : null,
          onTapUp:
              _interactive ? (_) => setState(() => _pressed = false) : null,
          onTapCancel:
              _interactive ? () => setState(() => _pressed = false) : null,
          onTap:
              _interactive
                  ? () {
                    HapticFeedback.lightImpact();
                    widget.onTap();
                  }
                  : null,
          child: content,
        ),
      ),
    );
  }
}

class _BestValueTag extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: NhamColors.accent20,
        borderRadius: BorderRadius.circular(NhamRadii.pill),
      ),
      child: Text(
        tr('paywall.bestValue').toUpperCase(),
        style: dashEyebrow(color: NhamColors.accentDark),
      ),
    );
  }
}
