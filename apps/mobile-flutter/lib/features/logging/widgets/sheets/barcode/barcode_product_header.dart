import 'package:cached_network_image/cached_network_image.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../../models/nutrition/barcode_product.dart';
import '../../../../../services/env/env.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_motion.dart';
import '../../../../../theme/kallo_theme.dart';

/// Brand, name and — when the store has one — the front-of-pack photo, so the
/// user can see at a glance that the scan found the right carton.
///
/// Port of the web's `barcode-product-header.tsx`. The photo comes through our
/// own API (`imageUrl` is a path, never a third-party URL) and carries the
/// credit its licence asks for. A photo that fails to load takes its credit
/// with it rather than leaving a blank frame.
class BarcodeProductHeader extends StatefulWidget {
  const BarcodeProductHeader({super.key, required this.product});

  final BarcodeProduct product;

  @override
  State<BarcodeProductHeader> createState() => _BarcodeProductHeaderState();
}

class _BarcodeProductHeaderState extends State<BarcodeProductHeader> {
  static const double _photoSize = 56;
  bool _photoFailed = false;

  void _onPhotoError(Object _) {
    // The image stream reports on its own schedule; defer the rebuild so it
    // can never land inside a build.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && !_photoFailed) setState(() => _photoFailed = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    final path = product.imageUrl;
    final showPhoto = path != null && !_photoFailed;
    final brand = product.brand;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (showPhoto) ...[
          Container(
            width: _photoSize,
            height: _photoSize,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: KalloColors.elev,
              borderRadius: BorderRadius.circular(KalloRadii.lg),
              border: Border.all(color: KalloColors.border),
            ),
            child: CachedNetworkImage(
              imageUrl: '${Env.apiBaseUrl}$path',
              fit: BoxFit.contain,
              memCacheWidth:
                  (_photoSize * MediaQuery.devicePixelRatioOf(context)).round(),
              fadeInDuration: KalloMotion.quick,
              placeholder: (_, _) => const SizedBox.shrink(),
              errorWidget: (_, _, _) => const SizedBox.shrink(),
              errorListener: _onPhotoError,
            ),
          ),
          const SizedBox(width: KalloSpacing.sp3),
        ],
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (brand != null && brand.isNotEmpty)
                Text(brand.toUpperCase(), style: dashEyebrow()),
              Text(product.name, style: kSectionHeader()),
              if (showPhoto)
                Text('logging.barcode.photoCredit'.tr(), style: dashMeta()),
            ],
          ),
        ),
      ],
    );
  }
}
