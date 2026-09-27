'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { ParsedBarcodeProduct } from '@/lib/domain/barcode/types';

/**
 * Brand, name and — when the store has one — the front-of-pack photo, so the
 * user can see at a glance that the scan found the right carton. The photo
 * comes through our own route (`imageUrl` is never a third-party URL) and
 * carries the credit its licence asks for. A photo that fails to load simply
 * disappears rather than leaving a broken frame.
 */
export function BarcodeProductHeader({
  product,
}: {
  product: ParsedBarcodeProduct;
}) {
  const t = useTranslations('logging');
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = product.imageUrl !== null && !photoFailed;

  return (
    <div className="flex items-start gap-3">
      {showPhoto && product.imageUrl ? (
        <Image
          src={product.imageUrl}
          alt={product.name}
          width={56}
          height={56}
          unoptimized
          onError={() => setPhotoFailed(true)}
          className="size-14 shrink-0 rounded-lg border border-[#EAE7E0] bg-white object-contain"
        />
      ) : null}
      <div className="min-w-0">
        {product.brand ? (
          <span className="font-medium font-sans-display text-[#8B8682] text-[11px] uppercase tracking-[0.12em]">
            {product.brand}
          </span>
        ) : null}
        <h3 className="font-normal font-sans-display text-[20px] text-kallo-text leading-snug tracking-tight">
          {product.name}
        </h3>
        {showPhoto ? (
          <span className="font-sans-display text-[#8B8682] text-[11px]">
            {t('barcodePhotoCredit')}
          </span>
        ) : null}
      </div>
    </div>
  );
}
