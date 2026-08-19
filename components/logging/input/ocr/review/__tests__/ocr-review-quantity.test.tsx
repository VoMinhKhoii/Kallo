import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OcrReviewQuantity } from '../ocr-review-quantity';

describe('OcrReviewQuantity', () => {
  it('keeps a fractional amount when decrementing would make it non-positive', () => {
    const onCommit = vi.fn();

    render(
      <OcrReviewQuantity
        amountText="0.5"
        unit="serving"
        amountIsValid
        servingAmount={null}
        packageAmount={null}
        amountLabel="Amount"
        invalidText="Enter a valid amount"
        servingText="Serving"
        packageText="Package"
        decreaseLabel="Decrease"
        increaseLabel="Increase"
        onChange={vi.fn()}
        onCommit={onCommit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Decrease' }));

    expect(onCommit).toHaveBeenCalledWith('0.5');
  });
});
