'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { serviceKey, calculateOrderPrice } = require('../functions/pricing');

function mockDb(prices) {
  return {
    doc(path) { return { path }; },
    async getAll(...refs) {
      return refs.map(ref => {
        const key = String(ref.path).split('/').pop();
        const value = prices[key];
        return {
          exists: value !== undefined,
          data() { return value; }
        };
      });
    }
  };
}

function price(category, name, overrides = {}) {
  const key = serviceKey(category, name);
  return [key, {
    serviceKey: key,
    active: true,
    automaticPaymentEligible: true,
    priceMinor: 1000,
    currency: 'EGP',
    mode: 'fixed',
    unitSize: 1,
    minQty: 1,
    maxQty: 100000,
    ...overrides
  }];
}

async function rejectsCode(promise, code) {
  await assert.rejects(promise, err => err && err.message === code);
}

test('service key is stable across harmless whitespace/case differences', () => {
  assert.equal(serviceKey('Instagram', 'Followers'), serviceKey(' instagram ', ' followers '));
});

test('fixed pricing multiplies minor-unit price by quantity', async () => {
  const [key, stored] = price('Instagram', 'Followers', { priceMinor: 2500 });
  const result = await calculateOrderPrice(mockDb({ [key]: stored }), {
    items: [{ category: 'Instagram', name: 'Followers', qty: 3, coupon: '' }]
  });
  assert.equal(result.amountMinor, 7500);
  assert.equal(result.currency, 'EGP');
  assert.equal(result.lines[0].amountMinor, 7500);
  assert.match(result.pricingHash, /^[a-f0-9]{64}$/);
});

test('per-unit pricing uses server unit size and rounds up minor units', async () => {
  const [key, stored] = price('TikTok', 'Views', {
    priceMinor: 500,
    mode: 'per_unit',
    unitSize: 1000
  });
  const result = await calculateOrderPrice(mockDb({ [key]: stored }), {
    items: [{ category: 'TikTok', name: 'Views', qty: 2501, coupon: '' }]
  });
  assert.equal(result.amountMinor, 1251);
});

test('automatic pricing rejects coupons until a server coupon engine exists', async () => {
  const [key, stored] = price('YouTube', 'Subscribers');
  await rejectsCode(calculateOrderPrice(mockDb({ [key]: stored }), {
    items: [{ category: 'YouTube', name: 'Subscribers', qty: 1, coupon: 'CLIENT10' }]
  }), 'COUPON_SERVER_RULE_REQUIRED');
});

test('inactive or non-auto-priced service cannot enter automatic payment', async () => {
  const [key, stored] = price('Facebook', 'Likes', { automaticPaymentEligible: false });
  await rejectsCode(calculateOrderPrice(mockDb({ [key]: stored }), {
    items: [{ category: 'Facebook', name: 'Likes', qty: 1, coupon: '' }]
  }), 'SERVICE_NOT_AUTO_PRICED');
});

test('quantity outside server bounds is rejected', async () => {
  const [key, stored] = price('Telegram', 'Members', { minQty: 100, maxQty: 1000 });
  await rejectsCode(calculateOrderPrice(mockDb({ [key]: stored }), {
    items: [{ category: 'Telegram', name: 'Members', qty: 50, coupon: '' }]
  }), 'QUANTITY_OUT_OF_RANGE');
});

test('mixed currency orders are rejected', async () => {
  const [k1, p1] = price('AI', 'Service A', { currency: 'EGP' });
  const [k2, p2] = price('AI', 'Service B', { currency: 'USD' });
  await rejectsCode(calculateOrderPrice(mockDb({ [k1]: p1, [k2]: p2 }), {
    items: [
      { category: 'AI', name: 'Service A', qty: 1, coupon: '' },
      { category: 'AI', name: 'Service B', qty: 1, coupon: '' }
    ]
  }), 'MIXED_CURRENCY_ORDER');
});

test('missing structured price is rejected', async () => {
  await rejectsCode(calculateOrderPrice(mockDb({}), {
    items: [{ category: 'Unknown', name: 'Missing', qty: 1, coupon: '' }]
  }), 'SERVICE_PRICE_NOT_FOUND');
});
