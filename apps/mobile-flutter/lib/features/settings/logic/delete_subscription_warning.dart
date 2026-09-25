import 'package:flutter/foundation.dart'
    show TargetPlatform, defaultTargetPlatform;

/// The RevenueCat store codes whose subscriptions are cancelled in the App
/// Store. `null` means the server reported no managing store (no subscription,
/// or a grant that carried none), where the App Store is the only place an iOS
/// user can have bought one.
const _appStoreStores = {'app_store', 'mac_app_store'};

/// The l10n key for the "deleting does not cancel your subscription" footnote
/// on the delete-account screen.
///
/// iOS never names another platform's store: App Review (guideline 2.3.10)
/// rejects that, and pointing iOS users at the web billing portal reads as
/// steering away from in-app purchase. Within that rule it follows the store
/// that actually manages the subscription ([managementStore], from the
/// entitlement): an App Store subscription gets App-Store copy, and one bought
/// elsewhere (Google Play, the web) gets store-neutral copy, so a cross-store
/// subscriber is not sent to the App Store to cancel a charge it cannot see.
/// Every other platform keeps the general copy that lists each place.
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
  return managementStore == null || _appStoreStores.contains(managementStore)
      ? 'settings.account.deleteSubscriptionWarningIos'
      : 'settings.account.deleteSubscriptionWarningIosOtherStore';
}
