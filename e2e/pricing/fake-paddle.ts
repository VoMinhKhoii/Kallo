import type { Page } from '@playwright/test';

// A stand-in for Paddle.js, served in place of cdn.paddle.com so /pricing's
// price preview is deterministic. Its preview mirrors the LIVE shape: while a
// price has a paid trial, the line totals are the trial charge, and the
// recurring price only lives on the price (its base + country overrides).
type Market = 'US' | 'VN';

const CATALOG = {
  // [monthly, annual] recurring amounts, then the first-week charge.
  usd: ['799', '2999', '89'],
  vnd: ['49000', '449000', '7999'],
};

function script(market: Market): string {
  return `
    const CATALOG = ${JSON.stringify(CATALOG)};
    const MARKET = ${JSON.stringify(market)};
    const vn = (amount) => [{ countryCodes: ['VN'], unitPrice: { amount, currencyCode: 'VND' } }];
    const price = (id, i) => ({
      id,
      unitPrice: { amount: CATALOG.usd[i], currencyCode: 'USD' },
      unitPriceOverrides: vn(CATALOG.vnd[i]),
      // Live Paddle.js leaves the trial's fields snake_case (captured
      // 2026-09-24), unlike the camelCase price around it.
      trialPeriod: {
        interval: 'day',
        frequency: 7,
        requires_payment_method: true,
        unit_price: { amount: CATALOG.usd[2], currency_code: 'USD' },
        unit_price_overrides: [
          { country_codes: ['VN'], unit_price: { amount: CATALOG.vnd[2], currency_code: 'VND' } },
        ],
      },
    });
    // paddle-js 1.x reads the Billing instance from window.PaddleBillingV1.
    window.PaddleBillingV1 = window.Paddle = {
      Environment: { set() {} },
      Initialize() {},
      Update() {},
      Initialized: true,
      PricePreview: async ({ items }) => ({
        data: {
          currencyCode: MARKET === 'VN' ? 'VND' : 'USD',
          address: { countryCode: MARKET },
          details: {
            lineItems: items.map((item, i) => ({
              price: price(item.priceId, i),
              unitTotals: { subtotal: MARKET === 'VN' ? CATALOG.vnd[2] : CATALOG.usd[2] },
            })),
          },
        },
      }),
    };`;
}

/** Serve the fake Paddle.js for the given market on every Paddle CDN load. */
export async function fakePaddle(page: Page, market: Market) {
  await page.route('https://cdn.paddle.com/**', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: script(market) })
  );
}
