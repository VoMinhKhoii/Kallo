import { expect, test } from '@playwright/test';
import { fakePaddle } from './fake-paddle';

// /pricing, signed out, with Paddle's price preview stubbed per market. The
// market (not the page language) decides the currency — that is the whole
// point of asking Paddle instead of the message file.

test.describe('/pricing live prices', () => {
  test('a US visitor sees USD prices and the $0.89 first week', async ({
    page,
  }) => {
    await fakePaddle(page, 'US');
    await page.goto('/en/pricing');

    const price = page.getByTestId('pricing-premium-price');
    const cta = page.getByTestId('pricing-premium-cta');
    const fineprint = page.getByTestId('pricing-premium-fineprint');

    // Yearly is the default: the per-month equivalent of $29.99.
    await expect(price).toContainText('$2.50');
    await expect(cta).toContainText('$0.89');
    await expect(page.getByTestId('pricing-save-chip')).toContainText('69%');
    await expect(fineprint).toContainText('$29.99');
    await expect(fineprint).toContainText('Tax calculated at checkout');

    await page.getByTestId('pricing-period-monthly').click();
    await expect(price).toContainText('$7.99');
    await expect(fineprint).toContainText('$7.99');
    // The saving chip belongs to the yearly plan only.
    await expect(page.getByTestId('pricing-save-chip')).toHaveCount(0);
  });

  test('a Vietnamese visitor sees đồng, whatever the page language', async ({
    page,
  }) => {
    await fakePaddle(page, 'VN');
    await page.goto('/en/pricing');

    const cta = page.getByTestId('pricing-premium-cta');
    const fineprint = page.getByTestId('pricing-premium-fineprint');
    await expect(cta).toContainText('7,999');
    await expect(fineprint).toContainText('449,000');

    await page.getByTestId('pricing-period-monthly').click();
    await expect(page.getByTestId('pricing-premium-price')).toContainText(
      '49,000'
    );
  });

  test('the Vietnamese page quotes the VN market in Vietnamese', async ({
    page,
  }) => {
    await fakePaddle(page, 'VN');
    await page.goto('/vi/pricing');

    await expect(page.getByTestId('pricing-premium-cta')).toContainText(
      '7.999'
    );
    await expect(page.getByTestId('pricing-premium-fineprint')).toContainText(
      'Thuế được tính khi thanh toán'
    );
  });

  test('never shows the first-week charge as the plan price', async ({
    page,
  }) => {
    await fakePaddle(page, 'US');
    await page.goto('/en/pricing');
    await page.getByTestId('pricing-period-monthly').click();
    await expect(page.getByTestId('pricing-premium-price')).not.toContainText(
      '$0.89'
    );
  });
});

test.describe('/pricing signed out', () => {
  test('the Free CTA opens sign-up, and there is no back link', async ({
    page,
  }) => {
    await fakePaddle(page, 'US');
    await page.goto('/en/pricing');
    await expect(page.getByTestId('pricing-back-link')).toHaveCount(0);
    await page.getByTestId('pricing-free-cta').click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('a safe ?from= path shows the back link; an external one does not', async ({
    page,
  }) => {
    await fakePaddle(page, 'US');
    await page.goto('/en/pricing?from=%2Fen%2Fsettings');
    await expect(page.getByTestId('pricing-back-link')).toHaveAttribute(
      'href',
      /\/en\/settings$/
    );

    await page.goto('/en/pricing?from=https%3A%2F%2Fevil.example');
    await expect(page.getByTestId('pricing-back-link')).toHaveCount(0);
  });
});
