import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

// The real ICU renderer: what is under test is the unit the copy prints.
vi.unmock('next-intl');

import { NextIntlClientProvider } from 'next-intl';
import type { ParsedBarcodeProduct } from '@/lib/domain/barcode/types';
import enLogging from '@/messages/en/logging.json';
import enNutrition from '@/messages/en/nutrition.json';
import { BarcodeProductStep } from '../barcode-product-step';

const coconutWater: ParsedBarcodeProduct = {
  barcode: '8938507849131',
  name: 'Coconut Water',
  brand: 'Coco Xim',
  caloriesKcal: 16,
  proteinG: 0,
  carbohydrateG: 4,
  fatG: 0,
  fiberG: null,
  sodiumMg: 39,
  servingSizeG: 330,
  packageSizeG: 1000,
  amountUnit: 'ml',
  imageUrl: '/api/v1/barcode/image/8938507849131',
  micronutrients: { calciumMg: 10, potassiumMg: 170 },
};

function renderStep(product: ParsedBarcodeProduct) {
  const onConfirm = vi.fn();
  render(
    <NextIntlClientProvider
      locale="en"
      messages={{ logging: enLogging, nutrition: enNutrition }}
    >
      <BarcodeProductStep
        product={product}
        isStaging={false}
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />
    </NextIntlClientProvider>
  );
  return { onConfirm };
}

describe('BarcodeProductStep', () => {
  it('measures a drink in millilitres everywhere on the sheet', async () => {
    renderStep(coconutWater);

    expect(screen.getByText('Nutrition for 330ml')).toBeTruthy();
    expect(screen.getByText(/330ml per serving/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Millilitres' })).toBeTruthy();
    expect(screen.queryByText(/\d+g total/)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Millilitres' }));
    expect(screen.getByText('Quantity (ml)')).toBeTruthy();
    expect(screen.getByRole('button', { name: '250ml' })).toBeTruthy();
  });

  it('keeps grams for a food', () => {
    renderStep({ ...coconutWater, amountUnit: 'g', servingSizeG: 30 });

    expect(screen.getByText('Nutrition for 30g')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Grams' })).toBeTruthy();
  });

  it('confirms the amount in the product unit', async () => {
    const { onConfirm } = renderStep(coconutWater);

    await userEvent.click(screen.getByRole('button', { name: 'Add meal' }));
    expect(onConfirm).toHaveBeenCalledWith(330);
  });

  it('shows the photo through our proxy, with its credit', () => {
    renderStep(coconutWater);

    const photo = screen.getByRole('img', { name: 'Coconut Water' });
    // Same-origin: next/image may absolutize it, but never off our host.
    const src = new URL(photo.getAttribute('src') ?? '', 'http://localhost');
    expect(src.pathname).toBe('/api/v1/barcode/image/8938507849131');
    expect(src.hostname).toBe('localhost');
    expect(screen.getByText('Photo: Open Food Facts')).toBeTruthy();
  });

  it('shows no photo and no credit when there is none', () => {
    renderStep({ ...coconutWater, imageUrl: null });

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText('Photo: Open Food Facts')).toBeNull();
  });

  it('lists the other nutrients for Premium, scaled to the amount', async () => {
    renderStep(coconutWater);

    const toggle = screen.getByRole('button', {
      name: 'Other nutrients on the label (3)',
    });
    await userEvent.click(toggle);

    // 330 ml of a per-100ml label: ×3.3.
    expect(screen.getByText('Sodium')).toBeTruthy();
    expect(screen.getByText('128.7 mg')).toBeTruthy();
    expect(screen.getByText('Calcium')).toBeTruthy();
    expect(screen.getByText('33 mg')).toBeTruthy();
    expect(screen.getByText('561 mg')).toBeTruthy();
  });

  it('shows nothing extra to a viewer the server stripped', () => {
    renderStep({
      ...coconutWater,
      fiberG: null,
      sodiumMg: null,
      micronutrients: null,
    });

    expect(screen.queryByText(/Other nutrients on the label/)).toBeNull();
  });
});
