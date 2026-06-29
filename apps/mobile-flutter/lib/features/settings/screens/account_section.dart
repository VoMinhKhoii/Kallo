import 'dart:convert';
import 'dart:io';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../data/api_client.dart';
import '../../../data/session_provider.dart';
import '../../../shared/widgets/nham_primitives.dart';
import '../../../shared/widgets/top_toast.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';

/// OAuth redirect for the manual-link browser flow — reuses the `nham://`
/// deep link the app already registers (Android intent-filter + iOS URL scheme).
const String _kLinkRedirect = 'nham://auth-callback';

/// File-private helper: show a top-anchored error toast.
void _showErrorToast(BuildContext context, String message) =>
    showTopToast(context, message, variant: TopToastVariant.error);

/// Account section of the settings list: linked sign-in methods, export data,
/// sign out (with a confirmation sheet), and permanent account deletion.
/// Account deletion is an App Store requirement whenever the app offers account
/// creation.
class AccountSection extends ConsumerStatefulWidget {
  const AccountSection({super.key});

  @override
  ConsumerState<AccountSection> createState() => _AccountSectionState();
}

class _AccountSectionState extends ConsumerState<AccountSection> {
  bool _exporting = false;
  bool _signingOut = false;

  Future<void> _export() async {
    if (_exporting) return;
    setState(() => _exporting = true);
    try {
      final data = await ref.read(apiClientProvider).exportMyData();
      final pretty = const JsonEncoder.withIndent('  ').convert(data);
      final dir = await getTemporaryDirectory();
      final stamp = DateTime.now().toIso8601String().split('T').first;
      final file = File('${dir.path}/nham-data-$stamp.json');
      await file.writeAsString(pretty);
      await Share.shareXFiles([XFile(file.path)]);
    } catch (_) {
      if (mounted) _showErrorToast(context, tr('settings.account.exportError'));
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _confirmSignOut() async {
    HapticFeedback.lightImpact(); // sheet-open cue
    final confirmed = await showCupertinoModalPopup<bool>(
      context: context,
      builder:
          (sheetContext) => CupertinoActionSheet(
            title: Text(tr('settings.account.signOutConfirmTitle')),
            actions: [
              CupertinoActionSheetAction(
                isDestructiveAction: true,
                onPressed: () => Navigator.of(sheetContext).pop(true),
                child: Text(tr('settings.account.signOut')),
              ),
            ],
            cancelButton: CupertinoActionSheetAction(
              onPressed: () => Navigator.of(sheetContext).pop(false),
              child: Text(tr('settings.account.cancel')),
            ),
          ),
    );
    if (confirmed != true || _signingOut) return;
    setState(() => _signingOut = true);
    try {
      await ref.read(authControllerProvider).signOut();
      if (!mounted) return;
      context.go('/sign-in');
    } catch (_) {
      if (!mounted) return;
      setState(() => _signingOut = false);
      _showErrorToast(context, tr('app.userMenu.signOutError'));
    }
  }

  void _openDelete() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const _AccountDeleteScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final busy = _exporting || _signingOut;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: NhamSpacing.sp3, bottom: 4),
          child: Text(
            tr('settings.account.title').toUpperCase(),
            style: NhamTextStyles.sansBold(
              fontSize: 10,
            ).copyWith(letterSpacing: 2.0, color: NhamColors.textMuted),
          ),
        ),
        const _LinkedAccountsRows(),
        _AccountRow(
          icon: LucideIcons.download,
          label: tr('settings.account.exportTitle'),
          busy: _exporting,
          enabled: !busy,
          onTap: _export,
        ),
        _AccountRow(
          icon: LucideIcons.logOut,
          label: tr('settings.account.signOut'),
          enabled: !busy,
          onTap: _confirmSignOut,
        ),
        _AccountRow(
          icon: LucideIcons.trash2,
          label: tr('settings.account.delete'),
          danger: true,
          enabled: !busy,
          onTap: _openDelete,
        ),
      ],
    );
  }
}

/// "Sign-in methods" rows: connect Google / Apple to this account, or
/// disconnect them. Linking uses the OAuth browser flow (no id-token link API),
/// so it hands off to the browser and returns via the `nham://auth-callback`
/// deep link — we refresh identities on the next app resume. The last remaining
/// identity can't be removed (it would lock the user out).
class _LinkedAccountsRows extends ConsumerStatefulWidget {
  const _LinkedAccountsRows();

  @override
  ConsumerState<_LinkedAccountsRows> createState() =>
      _LinkedAccountsRowsState();
}

class _LinkedAccountsRowsState extends ConsumerState<_LinkedAccountsRows> {
  List<UserIdentity>? _identities;
  String? _busyProvider; // provider with an action in flight
  bool _linkInFlight = false; // a browser link round-trip is pending
  bool _loadFailed = false; // initial identity fetch errored
  AppLifecycleListener? _lifecycle;

  @override
  void initState() {
    super.initState();
    _load();
    // Linking hands off to the browser; refresh identities when we return.
    _lifecycle = AppLifecycleListener(
      onResume: () {
        if (_linkInFlight) {
          _linkInFlight = false;
          _load();
        }
      },
    );
  }

  @override
  void dispose() {
    _lifecycle?.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final list = await ref.read(authControllerProvider).getUserIdentities();
      if (!mounted) return;
      setState(() {
        _identities = list;
        _busyProvider = null;
        _loadFailed = false;
      });
    } catch (_) {
      if (!mounted) return;
      // Surface the failure (don't leave the rows silently disabled) — the
      // build() shows a tappable retry row when no identities loaded.
      setState(() {
        _busyProvider = null;
        _loadFailed = true;
      });
    }
  }

  bool _isLinked(String provider) =>
      _identities?.any((i) => i.provider == provider) ?? false;

  Future<void> _connect(OAuthProvider provider) async {
    if (_busyProvider != null) return;
    setState(() {
      _busyProvider = provider.name;
      _linkInFlight = true;
    });
    try {
      await ref
          .read(authControllerProvider)
          .linkIdentity(provider, redirectTo: _kLinkRedirect);
      // The browser opened; the link completes via the deep link + onResume.
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _busyProvider = null;
        _linkInFlight = false;
      });
      _showErrorToast(context, tr('settings.account.linkError'));
    }
  }

  Future<void> _disconnect(UserIdentity identity) async {
    if ((_identities?.length ?? 0) <= 1 || _busyProvider != null) return;
    HapticFeedback.lightImpact();
    final confirmed = await showCupertinoModalPopup<bool>(
      context: context,
      builder: (sheetContext) => CupertinoActionSheet(
        title: Text(tr('settings.account.disconnectConfirmTitle')),
        actions: [
          CupertinoActionSheetAction(
            isDestructiveAction: true,
            onPressed: () => Navigator.of(sheetContext).pop(true),
            child: Text(tr('settings.account.disconnect')),
          ),
        ],
        cancelButton: CupertinoActionSheetAction(
          onPressed: () => Navigator.of(sheetContext).pop(false),
          child: Text(tr('settings.account.cancel')),
        ),
      ),
    );
    if (confirmed != true) return;
    setState(() => _busyProvider = identity.provider);
    try {
      await ref.read(authControllerProvider).unlinkIdentity(identity);
      await _load();
    } catch (_) {
      if (!mounted) return;
      setState(() => _busyProvider = null);
      _showErrorToast(context, tr('settings.account.unlinkError'));
    }
  }

  Widget _providerRow(
    OAuthProvider provider,
    String connectLabel,
    String connectedLabel,
  ) {
    // The identity provider string ('google' / 'apple') is the enum's own name.
    final key = provider.name;
    final total = _identities?.length ?? 0;
    if (_isLinked(key)) {
      return _AccountRow(
        icon: LucideIcons.check,
        label: connectedLabel,
        busy: _busyProvider == key,
        // Can't remove the last sign-in method (lockout), or mid-action.
        enabled: _busyProvider == null && total > 1,
        onTap: () => _disconnect(
          _identities!.firstWhere((i) => i.provider == key),
        ),
      );
    }
    return _AccountRow(
      icon: LucideIcons.link,
      label: connectLabel,
      busy: _busyProvider == key,
      enabled: _busyProvider == null && _identities != null,
      onTap: () => _connect(provider),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Initial fetch failed and nothing loaded — offer a retry instead of
    // silently disabled rows that misrepresent the user's linked methods.
    if (_identities == null && _loadFailed) {
      return _AccountRow(
        icon: LucideIcons.refreshCw,
        label: tr('settings.account.loadError'),
        onTap: _load,
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _providerRow(
          OAuthProvider.google,
          tr('settings.account.connectGoogle'),
          tr('settings.account.googleConnected'),
        ),
        // Apple sign-in is only offered on Apple platforms (App Store 4.8).
        if (Platform.isIOS || Platform.isMacOS)
          _providerRow(
            OAuthProvider.apple,
            tr('settings.account.connectApple'),
            tr('settings.account.appleConnected'),
          ),
      ],
    );
  }
}

class _AccountRow extends StatefulWidget {
  const _AccountRow({
    required this.icon,
    required this.label,
    required this.onTap,
    this.danger = false,
    this.busy = false,
    this.enabled = true,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool danger;
  final bool busy;
  final bool enabled;

  @override
  State<_AccountRow> createState() => _AccountRowState();
}

class _AccountRowState extends State<_AccountRow> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final color = widget.danger ? NhamColors.danger : NhamColors.textMuted;
    final pressedColor = widget.danger ? NhamColors.danger : NhamColors.text;
    final fill =
        widget.danger
            ? const Color(0x1AD37B69) // danger @ 10%
            : NhamColors.hover50;

    return Semantics(
      button: true,
      enabled: widget.enabled,
      excludeSemantics: true,
      label: widget.label,
      onTap: widget.enabled ? widget.onTap : null,
      child: Opacity(
        opacity: widget.enabled ? 1.0 : 0.6,
        child: GestureDetector(
          onTap: widget.enabled ? widget.onTap : null,
          onTapDown:
              widget.enabled ? (_) => setState(() => _pressed = true) : null,
          onTapUp:
              widget.enabled ? (_) => setState(() => _pressed = false) : null,
          onTapCancel:
              widget.enabled ? () => setState(() => _pressed = false) : null,
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: NhamSpacing.sp3,
              vertical: 10,
            ),
            decoration: BoxDecoration(
              color: _pressed ? fill : Colors.transparent,
              borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
            ),
            child: Row(
              children: [
                Icon(
                  widget.icon,
                  size: 16,
                  color: _pressed ? pressedColor : color,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    widget.label,
                    style: NhamTextStyles.sansMedium(
                      fontSize: NhamFontSize.sm,
                    ).copyWith(color: _pressed ? pressedColor : color),
                  ),
                ),
                if (widget.busy)
                  const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: NhamColors.textMuted,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Pushed delete-account screen: plain-language consequences and a type-to-
/// confirm gate before the irreversible deletion.
class _AccountDeleteScreen extends ConsumerStatefulWidget {
  const _AccountDeleteScreen();

  @override
  ConsumerState<_AccountDeleteScreen> createState() =>
      _AccountDeleteScreenState();
}

class _AccountDeleteScreenState extends ConsumerState<_AccountDeleteScreen> {
  final _controller = TextEditingController();
  bool _deleting = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool get _canDelete =>
      _controller.text.trim() == tr('settings.account.deleteConfirmWord') &&
      !_deleting;

  Future<void> _delete() async {
    if (!_canDelete) return;
    setState(() => _deleting = true);
    try {
      await ref.read(apiClientProvider).deleteAccount();
    } catch (_) {
      if (!mounted) return;
      setState(() => _deleting = false);
      _showErrorToast(context, tr('settings.account.deleteError'));
      return;
    }

    // The account is gone server-side. A local sign-out failure should not make
    // the destructive action look like it failed.
    try {
      await ref.read(authControllerProvider).signOut();
    } catch (_) {
      // Ignore: routing to sign-in clears the user's path out of the deleted
      // account state, and Supabase will refresh/reject the stale session.
    }
    if (!mounted) return;
    context.go('/sign-in');
  }

  @override
  Widget build(BuildContext context) {
    return Screen(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _DeleteBackHeader(onBack: () => Navigator.of(context).maybePop()),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(
                NhamSpacing.sp5,
                NhamSpacing.sp4,
                NhamSpacing.sp5,
                NhamSpacing.sp6,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    tr('settings.account.deleteScreenTitle'),
                    style: NhamTextStyles.serifRegular(
                      fontSize: NhamFontSize.h3,
                    ).copyWith(color: NhamColors.text),
                  ),
                  const SizedBox(height: NhamSpacing.sp3),
                  Text(
                    tr('settings.account.deleteConsequence'),
                    style: NhamTextStyles.sansRegular(
                      fontSize: NhamFontSize.sm,
                    ).copyWith(color: NhamColors.text, height: 1.5),
                  ),
                  const SizedBox(height: NhamSpacing.sp5),
                  Text(
                    tr(
                      'settings.account.deleteConfirmLabel',
                      namedArgs: {
                        'word': tr('settings.account.deleteConfirmWord'),
                      },
                    ),
                    style: NhamTextStyles.sansRegular(
                      fontSize: 12,
                    ).copyWith(color: NhamColors.textMuted),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _controller,
                    autocorrect: false,
                    enableSuggestions: false,
                    textCapitalization: TextCapitalization.characters,
                    style: NhamTextStyles.sansRegular(
                      fontSize: NhamFontSize.sm,
                    ).copyWith(color: NhamColors.text),
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: NhamColors.surface,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
                        borderSide: const BorderSide(color: NhamColors.border),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
                        borderSide: const BorderSide(color: NhamColors.danger),
                      ),
                    ),
                  ),
                  const SizedBox(height: NhamSpacing.sp4),
                  _DeleteButton(
                    enabled: _canDelete,
                    deleting: _deleting,
                    onTap: _delete,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DeleteButton extends StatelessWidget {
  const _DeleteButton({
    required this.enabled,
    required this.deleting,
    required this.onTap,
  });

  final bool enabled;
  final bool deleting;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1.0 : 0.4,
      child: GestureDetector(
        onTap: enabled ? onTap : null,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: NhamColors.danger,
            borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
          ),
          child: Center(
            child:
                deleting
                    ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                    : Text(
                      tr('settings.account.deleteConfirmAction'),
                      style: NhamTextStyles.sansMedium(
                        fontSize: NhamFontSize.sm,
                      ).copyWith(color: Colors.white),
                    ),
          ),
        ),
      ),
    );
  }
}

class _DeleteBackHeader extends StatelessWidget {
  const _DeleteBackHeader({required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: NhamColors.surface,
        border: Border(bottom: BorderSide(color: NhamColors.border)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onBack,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                LucideIcons.arrowLeft,
                size: 16,
                color: NhamColors.textMuted,
              ),
              const SizedBox(width: 6),
              Text(
                tr('settings.title'),
                style: NhamTextStyles.sansMedium(
                  fontSize: NhamFontSize.sm,
                ).copyWith(color: NhamColors.textMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
