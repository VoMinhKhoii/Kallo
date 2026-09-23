import '../../../services/analytics/analytics.dart';
import '../../../services/analytics/analytics_events.dart';
import '../../../services/billing/purchases_service.dart';

/// The store sheet is about to open for [packageId].
void trackCheckoutStarted(Analytics analytics, String packageId) {
  analytics.capture(
    AnalyticsEvents.checkoutStarted,
    properties: {'package_id': packageId},
  );
}

/// One analytics event per store outcome. A user cancel sends nothing: the
/// funnel reads it as "checkout started, never completed".
void trackPurchaseResult(
  Analytics analytics,
  PurchaseAttempt result,
  String packageId,
) {
  final props = <String, Object>{'package_id': packageId};
  switch (result.outcome) {
    case PurchaseOutcome.success || PurchaseOutcome.alreadyOwned:
      analytics.capture(
        AnalyticsEvents.purchaseCompleted,
        properties: {...props, 'status': 'paid'},
      );
    case PurchaseOutcome.paymentPending:
      analytics.capture(
        AnalyticsEvents.purchaseCompleted,
        properties: {...props, 'status': 'payment_pending'},
      );
    case PurchaseOutcome.error || PurchaseOutcome.accountConflict:
      analytics.capture(AnalyticsEvents.purchaseFailed, properties: props);
    case PurchaseOutcome.userCancelled:
      break;
  }
}
