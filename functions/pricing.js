'use strict';

const crypto = require('node:crypto');

const clean = v => String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
const normalize = v => clean(v).toLowerCase();

function serviceKey(category, serviceName) {
  return crypto.createHash('sha256').update(`${normalize(category)}\n${normalize(serviceName)}`).digest('hex');
}

function pricingError(code, status = 409) {
  const err = new Error(code);
  err.status = status;
  return err;
}

function validateStoredPrice(p, item) {
  if (!p || p.active !== true || p.automaticPaymentEligible !== true) throw pricingError('SERVICE_NOT_AUTO_PRICED');
  const priceMinor = Number(p.priceMinor);
  const unitSize = Number(p.unitSize || 1);
  const minQty = Number(p.minQty || 1);
  const maxQty = Number(p.maxQty || 5000000);
  const qty = Number(item.qty || 1);
  const currency = clean(p.currency).toUpperCase();
  const mode = p.mode === 'per_unit' ? 'per_unit' : 'fixed';

  if (!Number.isSafeInteger(priceMinor) || priceMinor <= 0) throw pricingError('INVALID_STORED_PRICE');
  if (!Number.isSafeInteger(qty) || qty < minQty || qty > maxQty) throw pricingError('QUANTITY_OUT_OF_RANGE');
  if (!Number.isSafeInteger(unitSize) || unitSize <= 0) throw pricingError('INVALID_UNIT_SIZE');
  if (!/^[A-Z]{3}$/.test(currency)) throw pricingError('INVALID_CURRENCY');

  const amountMinor = mode === 'per_unit'
    ? Math.ceil((qty * priceMinor) / unitSize)
    : priceMinor * qty;
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw pricingError('PRICE_OVERFLOW');
  return { amountMinor, currency, mode, priceMinor, unitSize, minQty, maxQty };
}

async function calculateOrderPrice(db, order) {
  if (!order || !Array.isArray(order.items) || !order.items.length) throw pricingError('EMPTY_ORDER', 400);
  if (order.items.some(it => clean(it && it.coupon))) throw pricingError('COUPON_SERVER_RULE_REQUIRED');

  const rows = order.items.map(item => ({
    item,
    key: serviceKey(item && item.category, item && item.name)
  }));
  const refs = rows.map(r => db.doc(`pricing/${r.key}`));
  const snaps = refs.length ? await db.getAll(...refs) : [];

  let currency = '';
  let total = 0;
  const lines = [];
  rows.forEach((row, i) => {
    const snap = snaps[i];
    if (!snap || !snap.exists) throw pricingError('SERVICE_PRICE_NOT_FOUND');
    const stored = snap.data();
    if (stored.serviceKey && stored.serviceKey !== row.key) throw pricingError('SERVICE_PRICE_KEY_MISMATCH');
    const priced = validateStoredPrice(stored, row.item);
    if (currency && currency !== priced.currency) throw pricingError('MIXED_CURRENCY_ORDER');
    currency = priced.currency;
    total += priced.amountMinor;
    if (!Number.isSafeInteger(total) || total <= 0) throw pricingError('ORDER_TOTAL_OVERFLOW');
    lines.push({
      key: row.key,
      name: clean(row.item.name).slice(0, 180),
      category: clean(row.item.category).slice(0, 140),
      qty: Number(row.item.qty || 1),
      amountMinor: priced.amountMinor,
      priceMinor: priced.priceMinor,
      unitSize: priced.unitSize,
      mode: priced.mode
    });
  });

  const pricingHash = crypto.createHash('sha256').update(JSON.stringify({ currency, total, lines })).digest('hex');
  return { amountMinor: total, currency, pricingHash, lines };
}

module.exports = { serviceKey, calculateOrderPrice };
