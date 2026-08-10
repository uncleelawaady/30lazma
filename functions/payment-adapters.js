'use strict';

// Provider implementations are intentionally NOT committed until the two gateways
// are selected. Secrets belong in Firebase/Google Secret Manager, never in Firestore
// or frontend code. Each adapter must implement both methods below.
const adapters = Object.create(null);

function registerPaymentAdapter(id, adapter) {
  if (!/^[a-z0-9_-]{2,80}$/i.test(String(id || ''))) throw new Error('INVALID_ADAPTER_ID');
  if (!adapter || typeof adapter.createCheckout !== 'function' || typeof adapter.verifyWebhook !== 'function') {
    throw new Error('INVALID_PAYMENT_ADAPTER');
  }
  adapters[id] = Object.freeze(adapter);
}

function getPaymentAdapter(id) {
  return adapters[String(id || '')] || null;
}

function listPaymentAdapters() {
  return Object.keys(adapters);
}

module.exports = { registerPaymentAdapter, getPaymentAdapter, listPaymentAdapters };
