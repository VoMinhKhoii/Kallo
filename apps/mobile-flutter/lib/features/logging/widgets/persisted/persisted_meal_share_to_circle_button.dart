import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:share_plus/share_plus.dart';

import '../../../../services/env/env.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../circle/data/circle_providers.dart';
import '../../data/logging_models.dart';
import '../entry/meal_action_icon_button.dart';

/// The per-meal "Share to circle" toggle plus, once shared, the "Share card"
/// action (the shareable Macro Card link). Optimistically flips its own state,
/// calls `POST /api/v1/groups/shares`, and reverts + toasts on failure.
/// Re-seeds from the server payload when the day refetches. Mirrors the web
/// `ShareToCircleButton` + `ShareCardButton` in `persisted-meal-card.tsx`.
class PersistedMealShareToCircleButton extends ConsumerStatefulWidget {
  const PersistedMealShareToCircleButton({
    super.key,
    required this.mealId,
    required this.share,
  });

  final String mealId;
  final MealShare? share;

  @override
  ConsumerState<PersistedMealShareToCircleButton> createState() =>
      _PersistedMealShareToCircleButtonState();
}

class _PersistedMealShareToCircleButtonState
    extends ConsumerState<PersistedMealShareToCircleButton> {
  late bool _shared = widget.share?.isShared ?? false;
  late String? _shareId =
      (widget.share?.isShared ?? false) ? widget.share!.shareId : null;
  bool _pending = false;

  @override
  void didUpdateWidget(covariant PersistedMealShareToCircleButton old) {
    super.didUpdateWidget(old);
    // Re-seed from fresh server state when the day refetches — but never mid
    // mutation, so the optimistic flip isn't stomped by a stale frame. Compare
    // the FULL share state: the shareId can change under the same visibility.
    final changed =
        widget.share?.visibility != old.share?.visibility ||
        widget.share?.shareId != old.share?.shareId;
    if (!_pending && changed) {
      _shared = widget.share?.isShared ?? false;
      _shareId = _shared ? widget.share?.shareId : null;
    }
  }

  Future<void> _toggle() async {
    if (_pending) return;
    HapticFeedback.lightImpact();
    final next = _shared ? 'private' : 'circle';
    setState(() {
      _pending = true;
      _shared = next == 'circle'; // optimistic
    });
    try {
      final result = await setMealShareVisibility(
        ref,
        mealId: widget.mealId,
        visibility: next,
      );
      if (!mounted) return;
      // The server response is the truth — not the requested `next` value.
      final isShared = result.visibility != 'private';
      setState(() {
        _pending = false;
        _shared = isShared;
        _shareId = isShared ? result.shareId : null;
      });
      // The icon-only toggle has no text flip to announce the change —
      // confirm it with a toast (web parity).
      showTopToast(
        context,
        tr(
          isShared
              ? 'groups.shareControl.sharedToast'
              : 'groups.shareControl.unsharedToast',
        ),
        variant: TopToastVariant.success,
      );
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _shared = !_shared; // revert
        _pending = false;
      });
      showTopToast(
        context,
        tr(
          next == 'circle'
              ? 'groups.shareControl.errorShare'
              : 'groups.shareControl.errorUnshare',
        ),
        variant: TopToastVariant.error,
      );
    }
  }

  Future<void> _shareCard() async {
    final shareId = _shareId;
    if (shareId == null) return;
    HapticFeedback.lightImpact();
    await Share.share(
      '${Env.webBaseUrl}/api/og/macro-card/$shareId',
      subject: tr('groups.shareControl.shareCardTitle'),
    );
  }

  @override
  Widget build(BuildContext context) {
    final label =
        _pending
            ? tr('groups.shareControl.sharing')
            : _shared
            ? tr('groups.shareControl.shared')
            : tr('groups.shareControl.share');
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // "Share card" appears only once the meal is shared (web parity).
        if (_shared && _shareId != null)
          MealActionIconButton(
            icon: LucideIcons.share2300,
            label: tr('groups.shareControl.shareCard'),
            onTap: _shareCard,
          ),
        MealActionIconButton(
          icon: _shared ? LucideIcons.check300 : LucideIcons.users300,
          label: label,
          active: _shared,
          pending: _pending,
          toggled: _shared,
          onTap: _toggle,
        ),
      ],
    );
  }
}
