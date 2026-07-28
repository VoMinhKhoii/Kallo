import 'dart:convert';
import 'dart:io';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../data/api_client.dart';
import '../../../data/session_provider.dart';
import '../../../shared/widgets/brand/apple_logo.dart';
import '../../../shared/widgets/brand/google_logo.dart';
import '../../../shared/widgets/top_toast.dart';
import '../widgets/settings_group.dart';
import '../widgets/settings_row.dart';
import 'account_delete_screen.dart';

/// OAuth redirect for the manual-link browser flow — reuses the `nham://`
/// deep link the app already registers (Android intent-filter + iOS URL scheme).
const String _kLinkRedirect = 'nham://auth-callback';

/// File-private helper: show a top-anchored error toast.
void _showErrorToast(BuildContext context, String message) =>
    showTopToast(context, message, variant: TopToastVariant.error);

/// Account section of the settings list: linked sign-in methods, export data,
/// and permanent account deletion. Account deletion is an App Store requirement
/// whenever the app offers account creation.
///
/// Sign out is deliberately NOT here: it is the bottom-most row of the whole
/// settings screen (`widgets/sign_out_row.dart`), so the session action people
/// reach for by habit isn't stacked against the irreversible delete row.
///
/// All rows live under ONE [SettingsGroup] — the linked-account rows and the
/// export/delete actions share the section — so the linked-account
/// async state (identities, in-flight link/unlink) is held here rather than in a
/// nested widget.
///
/// Linking uses the OAuth browser flow (no id-token link API), so it hands off
/// to the browser and returns via the `nham://auth-callback` deep link; we
/// refresh identities on the next app resume. The last remaining identity can't
/// be removed (it would lock the user out).
class AccountSection extends ConsumerStatefulWidget {
  const AccountSection({super.key});

  @override
  ConsumerState<AccountSection> createState() => _AccountSectionState();
}

class _AccountSectionState extends ConsumerState<AccountSection> {
  bool _exporting = false;
  bool _retrying = false; // manual retry of the initial identity fetch in flight

  // ── Linked sign-in methods state ──────────────────────────────────────
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
    // Only the manual retry row (shown after an empty initial load) gets a busy
    // spinner; the silent initState/resume loads don't flash one.
    final isRetry = _identities == null && _loadFailed;
    if (isRetry) setState(() => _retrying = true);
    try {
      final list = await ref.read(authControllerProvider).getUserIdentities();
      if (!mounted) return;
      setState(() {
        _identities = list;
        _busyProvider = null;
        _loadFailed = false;
        _retrying = false;
      });
    } catch (_) {
      if (!mounted) return;
      // Surface the failure (don't leave the rows silently disabled) — the
      // build() shows a tappable retry row when no identities loaded.
      final isRefresh = _identities != null;
      setState(() {
        _busyProvider = null;
        _loadFailed = true;
        _retrying = false;
      });
      // The retry row only covers the empty initial load; a failed *refresh*
      // (after link/unlink/resume) keeps the stale list, so toast it instead —
      // otherwise a failed reload reads as a successful no-op.
      if (isRefresh) _showErrorToast(context, tr('settings.account.loadError'));
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

  /// One linked-account row: "Connected via …" (tap to disconnect) or "Connect
  /// …" (tap to link). The last remaining identity can't be removed (lockout).
  ///
  /// The gutter shows the provider's real brand mark ([leading]) — Google's
  /// four-colour G, Apple in ink — rather than a generic Lucide glyph, mirroring
  /// web `components/settings/account/linked-accounts.tsx`.
  Widget _providerRow(
    OAuthProvider provider,
    Widget leading,
    String connectLabel,
    String connectedLabel,
  ) {
    // The identity provider string ('google' / 'apple') is the enum's own name.
    final key = provider.name;
    final total = _identities?.length ?? 0;
    if (_isLinked(key)) {
      return SettingsRow(
        leading: leading,
        label: connectedLabel,
        busy: _busyProvider == key,
        // Can't remove the last sign-in method (lockout), or mid-action.
        enabled: _busyProvider == null && total > 1,
        onTap: () =>
            _disconnect(_identities!.firstWhere((i) => i.provider == key)),
      );
    }
    return SettingsRow(
      leading: leading,
      label: connectLabel,
      busy: _busyProvider == key,
      enabled: _busyProvider == null && _identities != null,
      onTap: () => _connect(provider),
    );
  }

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

  void _openDelete() {
    Navigator.of(context).push(
      CupertinoPageRoute<void>(builder: (_) => const AccountDeleteScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final busy = _exporting;

    final rows = <Widget>[];

    // Linked sign-in methods — or a single retry row if the initial fetch
    // failed and nothing loaded (silently-disabled rows would misrepresent the
    // user's linked methods).
    if (_identities == null && _loadFailed) {
      rows.add(
        SettingsRow(
          icon: LucideIcons.refreshCw,
          label: tr('settings.account.loadError'),
          busy: _retrying,
          enabled: !_retrying,
          onTap: _load,
        ),
      );
    } else {
      rows.add(
        _providerRow(
          OAuthProvider.google,
          const GoogleLogo(size: 18),
          tr('settings.account.connectGoogle'),
          tr('settings.account.googleConnected'),
        ),
      );
      // Apple sign-in is only offered on Apple platforms (App Store 4.8).
      if (Platform.isIOS || Platform.isMacOS) {
        rows.add(
          _providerRow(
            OAuthProvider.apple,
            const AppleLogo(size: 18),
            tr('settings.account.connectApple'),
            tr('settings.account.appleConnected'),
          ),
        );
      }
    }

    rows.add(
      SettingsRow(
        icon: LucideIcons.download,
        label: tr('settings.account.exportTitle'),
        busy: _exporting,
        enabled: !busy,
        onTap: _export,
      ),
    );
    rows.add(
      SettingsRow(
        icon: LucideIcons.trash2,
        label: tr('settings.account.delete'),
        danger: true,
        enabled: !busy,
        onTap: _openDelete,
      ),
    );

    return SettingsGroup(
      label: tr('settings.account.title'),
      children: rows,
    );
  }
}
