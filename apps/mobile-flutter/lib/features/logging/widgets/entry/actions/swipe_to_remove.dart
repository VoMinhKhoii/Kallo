import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';
import '../../../logic/logging_spacing.dart';
import 'confirm_meal_removal.dart';

/// iOS trailing-swipe removal for a meal card: pull left to uncover the
/// destructive action, past the threshold to remove.
///
/// **Why the card is handed a border radius.** The red panel sits behind a
/// card that keeps its own 16px trailing corners as it slides, so red showed
/// through the two curved notches at the card's right edge — a rounded card
/// edge floating against a rounded red edge, reading as two separate shapes
/// rather than one surface being uncovered. Flattening the card's trailing
/// corners the moment the swipe starts makes the two meet on a straight seam,
/// which is what an iOS row does. The panel keeps all four of its own corners:
/// the left pair only ever becomes visible once the card is fully gone, and
/// they are wanted there.
///
/// The card's shadow goes with them. Cast onto a saturated red it read as
/// grime along the seam rather than as lift.
class SwipeToRemove extends StatefulWidget {
  const SwipeToRemove({
    super.key,
    required this.mealId,
    required this.onRemove,
    required this.builder,
  });

  /// Identifies the row to the [Dismissible] across rebuilds.
  final String mealId;

  /// Fired once the removal is confirmed and the row has gone. Null disables
  /// the swipe entirely, and the card is returned at rest.
  final VoidCallback? onRemove;

  /// Builds the card, given the shape it should take at this point in the
  /// swipe. [swiping] is false at rest, so a card at rest is untouched.
  final Widget Function(BuildContext context, BorderRadius radius, bool swiping)
  builder;

  @override
  State<SwipeToRemove> createState() => _SwipeToRemoveState();
}

class _SwipeToRemoveState extends State<SwipeToRemove> {
  static const BorderRadius _rest = BorderRadius.all(
    Radius.circular(KalloRadii.containerLg),
  );

  /// How much of the reveal the corners take to square off. A quarter, so the
  /// seam is already straight before any red is wide enough to read.
  static const double _flattenOver = 0.25;

  double _progress = 0;

  BorderRadius get _radius {
    if (_progress <= 0) return _rest;
    final t = (_progress / _flattenOver).clamp(0.0, 1.0);
    final trailing = Radius.circular(KalloRadii.containerLg * (1 - t));
    return BorderRadius.only(
      topLeft: const Radius.circular(KalloRadii.containerLg),
      bottomLeft: const Radius.circular(KalloRadii.containerLg),
      topRight: trailing,
      bottomRight: trailing,
    );
  }

  void _onUpdate(DismissUpdateDetails details) {
    if (details.progress == _progress) return;
    setState(() => _progress = details.progress);
  }

  @override
  Widget build(BuildContext context) {
    final onRemove = widget.onRemove;
    if (onRemove == null) return widget.builder(context, _rest, false);
    return Dismissible(
      key: ValueKey('dismiss-${widget.mealId}'),
      direction: DismissDirection.endToStart,
      confirmDismiss: (_) => confirmMealRemoval(context),
      onDismissed: (_) => onRemove(),
      onUpdate: _onUpdate,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp5),
        decoration: const BoxDecoration(
          color: KalloColors.danger,
          borderRadius: _rest,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              LucideIcons.trash2300,
              size: LoggingIcons.size,
              color: Colors.white,
            ),
            const SizedBox(width: 6),
            Text(
              'logging.remove'.tr(),
              style: dashBody(color: Colors.white, weight: FontWeight.w500),
            ),
          ],
        ),
      ),
      child: widget.builder(context, _radius, _progress > 0),
    );
  }
}
