import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../shared/widgets/toast/top_toast.dart';

/// Opens the platform's subscription-management surface. iOS uses the App
/// Store subscriptions screen and Android uses the Play Store deep link.
Future<void> openStoreSubscriptions(
  BuildContext context,
  String managementUrl,
) async {
  final opened = await launchUrl(
    Uri.parse(managementUrl),
    mode: LaunchMode.externalApplication,
  );
  if (!opened && context.mounted) {
    showTopToast(
      context,
      tr('paywall.purchaseError'),
      variant: TopToastVariant.error,
    );
  }
}
