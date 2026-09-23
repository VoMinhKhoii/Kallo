/// Every product event the app sends. Names and properties match the web
/// client (`lib/infra/analytics/events.ts` at the repo root) so one PostHog
/// funnel covers both. No event carries meal text or body metrics.
abstract final class AnalyticsEvents {
  /// A meal was saved to the log. Props: `method` (`ai`), `is_cheat`.
  static const mealLogged = 'meal_logged';

  /// The paywall was shown.
  static const paywallViewed = 'paywall_viewed';

  /// The user picked a package and the store sheet opened. Props: `package_id`.
  static const checkoutStarted = 'checkout_started';

  /// The store reported payment. Props: `package_id`, `status`
  /// (`paid` | `payment_pending`).
  static const purchaseCompleted = 'purchase_completed';

  /// The store call failed (not a user cancel). Props: `package_id`.
  static const purchaseFailed = 'purchase_failed';
}
