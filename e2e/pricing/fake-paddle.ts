import type { Page } from '@playwright/test';

// A stand-in for Paddle.js, served in place of cdn.paddle.com so /pricing's
// price preview is deterministic. Its preview mirrors the LIVE catalog: no
// trial on either price since 2026-09-30 (a paid first week fell under
// Paddle's minimum charge in Vietnam), so the line totals are the recurring
// charge, and the market's price lives on the price (base + country
// overrides).
type Market = 'US' | 'VN';

const CATALOG = {
  // [monthly, annual] recurring amounts.
  usd: ['799', '2999'],
  vnd: ['49000', '449000'],
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
      trialPeriod: null,
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
              unitTotals: { subtotal: MARKET === 'VN' ? CATALOG.vnd[i] : CATALOG.usd[i] },
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
