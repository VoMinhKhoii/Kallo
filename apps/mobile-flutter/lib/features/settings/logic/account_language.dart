import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../services/auth/session_provider.dart';
import '../../onboarding/data/onboarding_draft.dart';
import '../../onboarding/logic/region_defaults.dart';
import '../../onboarding/providers/onboarding_draft_providers.dart';
import '../../onboarding/providers/onboarding_providers.dart';

/// Set once this phone has reconciled its own language pick with the
/// account's (see [decideAccountLanguage]).
const String kAccountLanguageRepairedKey = 'kallo.accountLanguageRepaired';

final accountLanguageStorageProvider = Provider<KeyValueStore>(
  (ref) => const SecureKeyValueStore(),
);

enum AccountLanguageStep {
  /// The app already speaks the account's language.
  none,

  /// Switch the app to the account's language.
  adopt,

  /// Store the app's language on the account (once per phone).
  repair,
}

/// The account holds one language, and the app follows it: the web, the
/// phone's Settings and onboarding all save a pick there, and push text is
/// written in it, so the app speaking the same language keeps a reminder's
/// text and its buttons (registered in the app's language) in step.
///
/// One exception, once per phone: before accounts were followed, a web
/// profile save could set the account to the web page's language behind the
/// person's back. A phone where they picked a language ([appPicked]) still
/// holds their real choice, so on the first pass it is stored on the account
/// instead of being overwritten.
AccountLanguageStep decideAccountLanguage({
  required String? account,
  required String app,
  required bool appPicked,
  required bool repairPending,
}) {
  if (account == null || account == app) return AccountLanguageStep.none;
  if (repairPending && appPicked) return AccountLanguageStep.repair;
  return AccountLanguageStep.adopt;
}

/// How often a return to the foreground re-reads the account, so a language
/// changed on the web reaches an app that stayed alive in the background.
const Duration kAccountLanguageRefresh = Duration(minutes: 5);

/// Keeps the app in the signed-in account's language: on launch, on sign-in
/// (a new phone opens in the account's language rather than the English
/// default), and when the profile comes back with a different one (it is
/// re-read on a return to the foreground, at most every
/// [kAccountLanguageRefresh]).
///
/// Acts only when the account's language CHANGES from the last one handled,
/// so a refetch still carrying the old value never undoes a pick the person
/// just made and is saving. Waits while a signed-out onboarding draft is
/// still to be posted: its language reaches the account first.
class AccountLanguageSync extends ConsumerStatefulWidget {
  const AccountLanguageSync({required this.child, super.key});

  final Widget child;

  @override
  ConsumerState<AccountLanguageSync> createState() =>
      _AccountLanguageSyncState();
}

class _AccountLanguageSyncState extends ConsumerState<AccountLanguageSync>
    with WidgetsBindingObserver {
  String? _userId;

  /// The repair is for the account this phone was already signed into: once
  /// a signed-out state has been seen, the phone's pick may belong to someone
  /// else, and the next account is followed instead.
  bool _repairAllowed = true;

  DateTime _refreshedAt = DateTime.now();

  /// The account language last acted on, for [_userId].
  String? _handled;

  // Read from easy_localization in [didChangeDependencies], where inherited
  // lookups belong, and refreshed on every language change.
  String? _appLanguage;
  bool _appPicked = false;
  Future<void> Function(Locale)? _setLocale;

  bool _busy = false;

  /// A change that landed while a sync ran; it runs again after.
  bool _again = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    ref.listenManual(sessionProvider, (_, _) => unawaited(_sync()));
    ref.listenManual(profileProvider, (_, _) => unawaited(_sync()));
    ref.listenManual(onboardingDraftProvider, (_, _) => unawaited(_sync()));
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed || _userId == null) return;
    final now = DateTime.now();
    if (now.difference(_refreshedAt) < kAccountLanguageRefresh) return;
    _refreshedAt = now;
    ref.invalidate(profileProvider);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final l10n = EasyLocalization.of(context);
    _appLanguage = l10n?.locale.languageCode;
    // easy_localization reads a saved pick once, at launch.
    _appPicked = l10n?.savedLocale != null;
    _setLocale = l10n?.setLocale;
    unawaited(_sync());
  }

  Future<void> _sync() async {
    if (!mounted) return;
    if (_busy) {
      _again = true;
      return;
    }
    final app = _appLanguage;
    final setLocale = _setLocale;
    final session = ref.read(sessionProvider);
    if (!session.hasValue) return;
    final userId = session.value?.user.id;
    if (userId == null) {
      // Signed out: the next sign-in, even back into the same account, is
      // handled afresh.
      _userId = null;
      _handled = null;
      _repairAllowed = false;
      return;
    }
    final profile = ref.read(profileProvider);
    final account = supportedLocaleOrNull(profile.valueOrNull?.preferredLocale);
    if (app == null || setLocale == null) return;
    if (profile.isLoading || profile.hasError || account == null) return;
    if (userId != _userId) {
      _userId = userId;
      _handled = null;
    }
    if (account == _handled) return;
    final draft = ref.read(onboardingDraftProvider);
    if (draft.isLoading || !(draft.valueOrNull?.isEmpty ?? true)) return;

    _busy = true;
    try {
      final storage = ref.read(accountLanguageStorageProvider);
      // A read that fails (the keychain is locked while the phone is) is not
      // "never repaired": nothing happens until a read answers.
      final repairPending =
          await storage.read(kAccountLanguageRepairedKey) == null;
      if (!mounted) return;
      final step = decideAccountLanguage(
        account: account,
        app: app,
        appPicked: _appPicked,
        repairPending: repairPending && _repairAllowed,
      );
      // Marked before acting, so a failure is not retried in a loop on the
      // profile refetch it triggers; a failed repair runs again next launch.
      _handled = account;
      switch (step) {
        case AccountLanguageStep.repair:
          await ref
              .read(saveScreenControllerProvider)
              .save(step: 1, data: {'preferredLocale': app}, advance: false);
        case AccountLanguageStep.adopt:
          // The person changed the language while this ran: their pick is
          // on its way to the account, and wins.
          if (_appLanguage == app) await setLocale(Locale(account));
        case AccountLanguageStep.none:
          break;
      }
      if (repairPending) {
        await storage.write(kAccountLanguageRepairedKey, '1');
      }
    } catch (error) {
      debugPrint('[language] account sync failed: $error');
    } finally {
      _busy = false;
      if (_again && mounted) {
        _again = false;
        unawaited(_sync());
      }
    }
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
