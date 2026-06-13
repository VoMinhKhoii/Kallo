'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { searchBarcodeAction, stageBarcodeMealAction } from '@/lib/actions/barcode';
import type { ParsedBarcodeProduct } from '@/lib/barcode/openfoodfacts';
import { Barcode, Search, Loader2, ChevronLeft, Plus, Minus } from 'lucide-react';

interface BarcodeScannerDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string;
  onSuccess: () => void;
}

export function BarcodeScannerDialog({
  isOpen,
  onOpenChange,
  selectedDate,
  onSuccess,
}: BarcodeScannerDialogProps) {
  const t = useTranslations('logging');
  const [step, setStep] = useState<'input' | 'quantity'>('input');
  const [barcode, setBarcode] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [product, setProduct] = useState<ParsedBarcodeProduct | null>(null);
  
  // Quantity states
  const [grams, setGrams] = useState<number>(100);
  const [isStaging, setIsStaging] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!barcode.trim()) return;

    setIsSearching(true);
    setSearchError(null);

    const res = await searchBarcodeAction({ barcode: barcode.trim() });
    setIsSearching(false);

    if (res.success) {
      setProduct(res.data);
      setStep('quantity');
    } else {
      setSearchError(res.error);
    }
  };

  const handleStageMeal = async () => {
    if (!product) return;

    setIsStaging(true);
    const timezoneOffset = new Date().getTimezoneOffset();

    const res = await stageBarcodeMealAction({
      barcode: product.barcode,
      grams,
      loggedDate: selectedDate,
      timezoneOffset,
    });

    setIsStaging(false);

    if (res.success) {
      toast.success(t('feedArea.savedMeal'));
      onSuccess();
      handleClose();
    } else {
      toast.error(res.error);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset states after animation closes
    setTimeout(() => {
      setStep('input');
      setBarcode('');
      setSearchError(null);
      setProduct(null);
      setGrams(100);
    }, 200);
  };

  const adjustGrams = (amount: number) => {
    setGrams((prev) => Math.max(1, prev + amount));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="border-nham-border bg-nham-surface text-nham-text sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-[var(--font-lora)] font-normal text-2xl text-nham-text">
            {t('barcodeDialogTitle')}
          </DialogTitle>
          <DialogDescription className="text-nham-text-muted text-sm leading-normal">
            {t('barcodeDialogDesc')}
          </DialogDescription>
        </DialogHeader>

        {step === 'input' ? (
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="space-y-2">
              <div className="relative flex items-center">
                <Barcode className="absolute left-3 h-5 w-5 text-nham-text-muted/60" />
                <Input
                  type="text"
                  pattern="\d*"
                  inputMode="numeric"
                  placeholder={t('barcodePlaceholder')}
                  value={barcode}
                  onChange={(e) => {
                    setBarcode(e.target.value.replace(/\D/g, ''));
                    setSearchError(null);
                  }}
                  autoFocus
                  disabled={isSearching}
                  className="border-nham-border/60 bg-background pl-10 focus-visible:border-nham-accent/50 focus-visible:ring-1 focus-visible:ring-nham-accent/50"
                />
              </div>

              {searchError && (
                <div className="rounded-lg bg-nham-danger/10 p-3 text-nham-danger text-sm leading-snug">
                  {searchError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                className="text-nham-text-muted hover:bg-nham-hover hover:text-nham-text"
              >
                {t('feedArea.partialYesterdayPrompt.dismiss')}
              </Button>
              <Button
                type="submit"
                disabled={isSearching || !barcode.trim()}
                className="bg-nham-btn text-white hover:bg-nham-btn-hover active:scale-95 disabled:opacity-50"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('barcodeSearching')}
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    {t('barcodeSearch')}
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          product && (
            <div className="space-y-6">
              {/* Product Header */}
              <div className="border-nham-border/40 border-b pb-3">
                {product.brand && (
                  <span className="font-[var(--font-dm-sans)] text-xs text-nham-text-muted uppercase tracking-wider">
                    {product.brand}
                  </span>
                )}
                <h3 className="font-[var(--font-lora)] text-xl font-normal text-nham-text">
                  {product.name}
                </h3>
              </div>

              {/* Nutrition Profile per 100g */}
              <div className="space-y-2">
                <span className="text-xs text-nham-text-muted">
                  Dinh dưỡng trên 100g:
                </span>
                <div className="grid grid-cols-4 gap-2">
                  <div className="rounded-xl border border-nham-border/30 bg-background p-2.5 text-center">
                    <span className="block text-[10px] text-nham-text-muted uppercase tracking-wider">
                      Calo
                    </span>
                    <span className="font-[var(--font-lora)] text-base font-normal text-nham-text">
                      {product.caloriesKcal !== null ? Math.round(product.caloriesKcal) : '--'}
                    </span>
                    <span className="block text-[9px] text-nham-text-muted">kcal</span>
                  </div>

                  <div className="rounded-xl border border-nham-border/30 bg-background p-2.5 text-center">
                    <span className="block text-[10px] text-nham-text-muted uppercase tracking-wider">
                      Đạm
                    </span>
                    <span className="font-[var(--font-lora)] text-base font-normal text-nham-text">
                      {product.proteinG !== null ? product.proteinG : '--'}
                    </span>
                    <span className="block text-[9px] text-nham-text-muted">g</span>
                  </div>

                  <div className="rounded-xl border border-nham-border/30 bg-background p-2.5 text-center">
                    <span className="block text-[10px] text-nham-text-muted uppercase tracking-wider">
                      Carb
                    </span>
                    <span className="font-[var(--font-lora)] text-base font-normal text-nham-text">
                      {product.carbohydrateG !== null ? product.carbohydrateG : '--'}
                    </span>
                    <span className="block text-[9px] text-nham-text-muted">g</span>
                  </div>

                  <div className="rounded-xl border border-nham-border/30 bg-background p-2.5 text-center">
                    <span className="block text-[10px] text-nham-text-muted uppercase tracking-wider">
                      Béo
                    </span>
                    <span className="font-[var(--font-lora)] text-base font-normal text-nham-text">
                      {product.fatG !== null ? product.fatG : '--'}
                    </span>
                    <span className="block text-[9px] text-nham-text-muted">g</span>
                  </div>
                </div>
              </div>

              {/* Quantity Input */}
              <div className="space-y-2">
                <label htmlFor="grams-input" className="text-sm font-medium text-nham-text-muted">
                  {t('barcodeGramsLabel')}
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => adjustGrams(-50)}
                    disabled={grams <= 50}
                    className="border-nham-border/60 hover:bg-nham-hover"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  
                  <Input
                    id="grams-input"
                    type="number"
                    min="1"
                    max="10000"
                    value={grams}
                    onChange={(e) => setGrams(Math.max(1, parseInt(e.target.value) || 0))}
                    className="border-nham-border/60 bg-background text-center font-medium focus-visible:border-nham-accent/50 focus-visible:ring-1 focus-visible:ring-nham-accent/50"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => adjustGrams(50)}
                    className="border-nham-border/60 hover:bg-nham-hover"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Quick select chips */}
                <div className="flex gap-2 pt-1">
                  {[50, 100, 150, 200, 250].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setGrams(val)}
                      className={`rounded-full border px-3 py-1 text-xs transition-all duration-200 ${
                        grams === val
                          ? 'border-nham-accent/60 bg-nham-cheat-fill text-nham-text'
                          : 'border-nham-border/30 bg-background text-nham-text-muted hover:bg-nham-hover'
                      }`}
                    >
                      {val}g
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep('input')}
                  className="text-nham-text-muted hover:bg-nham-hover hover:text-nham-text"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  {t('barcodeBack')}
                </Button>
                <Button
                  type="button"
                  onClick={handleStageMeal}
                  disabled={isStaging || grams <= 0}
                  className="bg-nham-btn text-white hover:bg-nham-btn-hover active:scale-95 disabled:opacity-50"
                >
                  {isStaging ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('analyzing')}
                    </>
                  ) : (
                    t('barcodeAddMeal')
                  )}
                </Button>
              </div>
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
