import 'package:flutter/foundation.dart'
    show TargetPlatform, defaultTargetPlatform;

/// The RevenueCat store codes whose subscriptions are cancelled in the App
/// Store.
const _appStoreStores = {'app_store', 'mac_app_store'};

/// The l10n key for the "deleting does not cancel your subscription" footnote
/// on the delete-account screen.
///
/// iOS never names another platform's store: App Review (guideline 2.3.10)
/// rejects that, and pointing iOS users at the web billing portal reads as
/// steering away from in-app purchase. Within that rule, App Store copy is
/// shown only when the entitlement says the App Store manages the
/// subscription ([managementStore]). Everything else — another store, no
/// subscription, or an entitlement still loading or failed to load (the
/// caller passes `null`) — gets store-neutral copy, which is true in every
/// case, so a cross-store subscriber is never sent to the App Store to cancel
/// a charge it cannot see. Every other platform keeps the general copy that
/// lists each place.
///
/// Keyed on [defaultTargetPlatform] rather than `dart:io`'s `Platform` so a
/// test can switch it with `debugDefaultTargetPlatformOverride`.
String deleteSubscriptionWarningKey({
  TargetPlatform? platform,
  String? managementStore,
}) {
  if ((platform ?? defaultTargetPlatform) != TargetPlatform.iOS) {
    return 'settings.account.deleteSubscriptionWarning';
  }
  return _appStoreStores.contains(managementStore)
      ? 'settings.account.deleteSubscriptionWarningIos'
      : 'settings.account.deleteSubscriptionWarningIosOtherStore';
}
