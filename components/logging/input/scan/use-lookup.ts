'use client';

import { useCallback, useRef, useState } from 'react';
import { searchBarcodeAction } from '@/lib/actions/logging/barcode';
import { tryDecodeFontEncodedBarcode } from '@/lib/domain/barcode/decode';
import type {
  BarcodeErrorCode,
  ParsedBarcodeProduct,
} from '@/lib/domain/barcode/types';

/** A lookup: the code (digits only) and the camera frame it was read in —
 *  held under the result — once there is one. */
export type ScanLookup =
  | { phase: 'idle'; frame: null }
  | { phase: 'searching'; code: string; frame: string | null }
  | {
      phase: 'found';
      code: string;
      product: ParsedBarcodeProduct;
      frame: string | null;
    }
  | {
      phase: 'miss';
      code: string;
      error: BarcodeErrorCode;
      frame: string | null;
    };

const IDLE: ScanLookup = { phase: 'idle', frame: null };

/**
 * Looking a barcode up. A lookup that lands after the user moved on (closed,
 * switched mode, went back to scanning) is dropped by the generation counter
 * rather than raising a result they already left.
 */
export function useScanLookup() {
  const [lookup, setLookup] = useState<ScanLookup>(IDLE);
  const generationRef = useRef(0);

  const search = useCallback(
    async (raw: string, frame: string | null = null) => {
      const generation = ++generationRef.current;
      const code = tryDecodeFontEncodedBarcode(raw);
      setLookup({ phase: 'searching', code, frame });
      let next: ScanLookup;
      try {
        const res = await searchBarcodeAction({ barcode: code });
        next = res.success
          ? { phase: 'found', code, product: res.data, frame }
          : { phase: 'miss', code, error: res.code, frame };
      } catch {
        next = { phase: 'miss', code, error: 'server_error', frame };
      }
      if (generation === generationRef.current) setLookup(next);
    },
    []
  );

  const reset = useCallback(() => {
    generationRef.current += 1;
    setLookup(IDLE);
  }, []);

  return { lookup, search, reset };
}
