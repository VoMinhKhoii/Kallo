import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../data/api_client.dart';
import '../../../models/circle.dart';
import '../../../shared/widgets/nham_primitives.dart';
import '../../../shared/widgets/top_toast.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../data/circle_providers.dart';

/// The invite-accept target (deep link `/circle/invite/:slug`). Previews the
/// inviter and, depending on the viewer's relationship, shows Accept / already
/// connected / your own link / invalid / signed-out. Accepting resolves IN
/// PLACE — the recipient's disc slides in beside the inviter's and the title
/// crossfades to "You're connected" — never a teleport to a (usually empty)
/// circle at the moment of commitment. Mirrors the web
/// `app/[locale]/invite/[slug]/page.tsx` + `ConnectPanel`.
class ConnectScreen extends ConsumerStatefulWidget {
  const ConnectScreen({required this.slug, super.key});

  final String slug;

  @override
  ConsumerState<ConnectScreen> createState() => _ConnectScreenState();
}

class _ConnectScreenState extends ConsumerState<ConnectScreen> {
  @override
  void initState() {
    super.initState();
    // We've arrived — consume any stashed invite so a later sign-out/in doesn't
    // re-route here unexpectedly. Deferred so we don't mutate a provider that
    // the router's redirect may still be reading during this frame.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        ref.read(pendingInviteSlugProvider.notifier).state = null;
      }
    });
  }

  void _signIn() {
    // Stash the slug so the router routes back here once signed in.
    ref.read(pendingInviteSlugProvider.notifier).state = widget.slug;
    context.go('/sign-in');
  }

  @override
  Widget build(BuildContext context) {
    final previewAsync = ref.watch(invitePreviewProvider(widget.slug));

    return Screen(
      child: Stack(
        children: [
          Align(
            alignment: Alignment.topLeft,
            child: Padding(
              padding: const EdgeInsets.all(NhamSpacing.sp2),
              child: IconButton(
                icon: const Icon(LucideIcons.x, size: 22),
                color: NhamColors.textMuted,
                onPressed: () =>
                    context.canPop() ? context.pop() : context.go('/circle'),
              ),
            ),
          ),
          Center(
            child: Padding(
              padding: const EdgeInsets.all(NhamSpacing.sp5),
              child: previewAsync.when(
                loading: () => const CircularProgressIndicator(
                  color: NhamColors.accent,
                ),
                error: (error, _) => _errorFor(error),
                data: (preview) => _stateFor(preview),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// A 404 means the link is genuinely invalid; anything else (offline, 5xx)
  /// must say "try again" — not lie that the invite is bad.
  Widget _errorFor(Object error) {
    if (error is ApiError && error.status == 404) {
      return _Shell(
        title: tr('groups.connect.invalidTitle'),
        body: tr('groups.connect.invalidBody'),
        children: const [_GoToCircleButton()],
      );
    }
    return _RetryState(
      onRetry: () => ref.invalidate(invitePreviewProvider(widget.slug)),
    );
  }

  Widget _stateFor(InvitePreview preview) {
    final name = preview.inviter.label;

    if (preview.signedOut) {
      return _Shell(
        profile: preview.inviter,
        title: tr('groups.connect.signedOutTitle', namedArgs: {'name': name}),
        body: tr('groups.connect.signedOutBody'),
        children: [
          SizedBox(
            width: double.infinity,
            child: NhamButton(
              title: tr('groups.connect.signIn'),
              onPressed: _signIn,
            ),
          ),
        ],
      );
    }

    switch (preview.relation) {
      case InviteRelation.self:
        return _Shell(
          title: tr('groups.connect.selfTitle'),
          body: tr('groups.connect.selfBody'),
          children: const [_GoToCircleButton()],
        );
      case InviteRelation.accepted:
        return _Shell(
          profile: preview.inviter,
          title: tr('groups.connect.alreadyTitle', namedArgs: {'name': name}),
          body: tr('groups.connect.alreadyBody'),
          children: const [_GoToCircleButton()],
        );
      // The preview endpoint 404s blocked edges, so this is unreachable —
      // kept as a defensive fallback rendering the same invalid state.
      case InviteRelation.blocked:
        return _Shell(
          title: tr('groups.connect.invalidTitle'),
          body: tr('groups.connect.invalidBody'),
          children: const [_GoToCircleButton()],
        );
      case InviteRelation.none:
        return _ConnectPanel(slug: widget.slug, inviter: preview.inviter);
    }
  }
}

/// The full Connect state, resolved IN PLACE. Before accepting: the inviter's
/// disc, the "Connect with {name}" title, and the Accept button. On success the
/// recipient's disc slides in beside the inviter's, the title crossfades to
/// "You're connected", and going to the circle becomes a choice. Mirrors
/// `components/groups/invite/connect-panel.tsx`.
class _ConnectPanel extends ConsumerStatefulWidget {
  const _ConnectPanel({required this.slug, required this.inviter});

  final String slug;
  final CircleProfile inviter;

  @override
  ConsumerState<_ConnectPanel> createState() => _ConnectPanelState();
}

class _ConnectPanelState extends ConsumerState<_ConnectPanel> {
  bool _accepting = false;
  bool _connected = false;

  Future<void> _accept() async {
    if (_accepting || _connected) return;
    HapticFeedback.lightImpact();
    setState(() => _accepting = true);
    try {
      await acceptCircleInvite(ref, widget.slug);
      if (!mounted) return;
      setState(() {
        _accepting = false;
        _connected = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _accepting = false);
      showTopToast(context, tr('groups.connect.error'),
          variant: TopToastVariant.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    // How the recipient appears beside the inviter once connected.
    final myProfile = ref.watch(myCircleProfileProvider).valueOrNull;
    final youLabel = myProfile?.label ?? tr('groups.connect.you');

    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 360),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Discs: inviter alone, then the recipient's slides in beside it.
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _Disc(label: widget.inviter.label),
              AnimatedSize(
                duration: const Duration(milliseconds: 300),
                curve: Curves.easeOut,
                child: _connected
                    ? Padding(
                        padding: const EdgeInsets.only(left: NhamSpacing.sp2),
                        child: TweenAnimationBuilder<double>(
                          tween: Tween(begin: 0, end: 1),
                          duration: const Duration(milliseconds: 450),
                          curve: Curves.easeOut,
                          builder: (context, t, child) => Opacity(
                            opacity: t,
                            child: Transform.translate(
                              offset: Offset(-14 * (1 - t), 0),
                              child: Transform.scale(
                                scale: 0.9 + 0.1 * t,
                                child: child,
                              ),
                            ),
                          ),
                          child: _Disc(label: youLabel, highlighted: true),
                        ),
                      )
                    : const SizedBox.shrink(),
              ),
            ],
          ),
          const SizedBox(height: NhamSpacing.sp5),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 300),
            child: Text(
              _connected
                  ? tr('groups.connect.connectedTitle')
                  : tr('groups.connect.connectTitle',
                      namedArgs: {'name': widget.inviter.label}),
              key: ValueKey(_connected),
              textAlign: TextAlign.center,
              style: NhamTextStyles.serifRegular(fontSize: NhamFontSize.h3)
                  .copyWith(
                color: NhamColors.text,
                letterSpacing: NhamTracking.tight,
              ),
            ),
          ),
          const SizedBox(height: NhamSpacing.sp2),
          Text(
            _connected
                ? tr('groups.connect.connectedBody')
                : tr('groups.connect.connectBody'),
            textAlign: TextAlign.center,
            style: NhamTextStyles.sansRegular(
              fontSize: NhamFontSize.sm,
              height: NhamLeading.relaxed,
            ).copyWith(color: NhamColors.textMuted),
          ),
          const SizedBox(height: NhamSpacing.sp5),
          if (_connected)
            const _GoToCircleButton()
          else
            SizedBox(
              width: double.infinity,
              child: NhamButton(
                title: tr('groups.connect.accept'),
                loading: _accepting,
                onPressed: _accept,
              ),
            ),
        ],
      ),
    );
  }
}

/// The 56px initials disc from the web ConnectPanel — the recipient's is
/// highlighted with a stronger tint + accent ring once connected.
class _Disc extends StatelessWidget {
  const _Disc({required this.label, this.highlighted = false});

  final String label;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final initial = label.isEmpty ? '·' : label.characters.first.toUpperCase();
    return Container(
      width: 56,
      height: 56,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: highlighted
              ? const [Color(0x8CC9A87C), Color(0x99E8D5B5)] // 55% → 60%
              : const [NhamColors.accent40, NhamColors.borderHalf],
        ),
        border: Border.all(
          color: highlighted
              ? NhamColors.accent40
              : const Color(0x40C9A87C), // accent @ 25%
          width: highlighted ? 2 : 1,
        ),
      ),
      child: Text(
        initial,
        style: NhamTextStyles.sansBold(fontSize: NhamFontSize.h4)
            .copyWith(color: NhamColors.btn),
      ),
    );
  }
}

/// The centered cream card shared by every static invite state.
class _Shell extends StatelessWidget {
  const _Shell({
    required this.title,
    required this.body,
    this.profile,
    this.children = const [],
  });

  final String title;
  final String body;
  final CircleProfile? profile;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 360),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (profile != null) ...[
            _Disc(label: profile!.label),
            const SizedBox(height: NhamSpacing.sp5),
          ],
          Text(
            title,
            textAlign: TextAlign.center,
            style: NhamTextStyles.serifRegular(fontSize: NhamFontSize.h3)
                .copyWith(
              color: NhamColors.text,
              letterSpacing: NhamTracking.tight,
            ),
          ),
          const SizedBox(height: NhamSpacing.sp2),
          Text(
            body,
            textAlign: TextAlign.center,
            style: NhamTextStyles.sansRegular(
              fontSize: NhamFontSize.sm,
              height: NhamLeading.relaxed,
            ).copyWith(color: NhamColors.textMuted),
          ),
          if (children.isNotEmpty) ...[
            const SizedBox(height: NhamSpacing.sp5),
            ...children,
          ],
        ],
      ),
    );
  }
}

/// Network/server failure while previewing — a retryable state, NOT the
/// "invite not valid" shell (which would be a lie offline).
class _RetryState extends StatelessWidget {
  const _RetryState({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return _Shell(
      title: tr('groups.error.title'),
      body: tr('groups.error.body'),
      children: [
        SizedBox(
          width: double.infinity,
          child: NhamButton(
            title: tr('groups.error.retry'),
            variant: NhamButtonVariant.secondary,
            onPressed: onRetry,
          ),
        ),
      ],
    );
  }
}

class _GoToCircleButton extends StatelessWidget {
  const _GoToCircleButton();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: NhamButton(
        title: tr('groups.connect.goToCircle'),
        variant: NhamButtonVariant.secondary,
        onPressed: () => context.go('/circle'),
      ),
    );
  }
}
