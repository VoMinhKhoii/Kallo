import 'package:flutter/foundation.dart'
    show TargetPlatform, defaultTargetPlatform;

/// The l10n key for the "deleting does not cancel your subscription" footnote
/// on the delete-account screen.
///
/// iOS gets its own copy: App Review (guideline 2.3.10) rejects an iOS build
/// that names another platform's store, and pointing iOS users at the web
/// billing portal reads as steering away from in-app purchase. An iOS
/// subscription can only have been bought through the App Store, so that is
/// the one place the iOS copy names. Every other platform keeps the general
/// copy that lists each place a subscription can be managed.
///
/// Keyed on [defaultTargetPlatform] rather than `dart:io`'s `Platform` so a
/// test can switch it with `debugDefaultTargetPlatformOverride`.
String deleteSubscriptionWarningKey([TargetPlatform? platform]) =>
    (platform ?? defaultTargetPlatform) == TargetPlatform.iOS
        ? 'settings.account.deleteSubscriptionWarningIos'
        : 'settings.account.deleteSubscriptionWarning';
