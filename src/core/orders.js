// ===== Order rules =====
//
// Domain rules about orders, shared by every adapter so they cannot drift.
// Pure logic — no Firebase, no SQL, no DOM.

import { PortError, ERROR_CODES } from '../ports/index.js';

/**
 * The minimum an order must carry before any adapter will persist it.
 * Storage-layer authorization (firestore.rules today) validates the same shape
 * independently; this is the early, legible failure on the way in.
 *
 * @throws {PortError} with code `invalid`
 */
export function assertOrderShape(order) {
  if (!order || typeof order !== 'object' || Array.isArray(order)) {
    throw new PortError(ERROR_CODES.INVALID, 'an order must be an object');
  }
  if (!order.orderNo) {
    throw new PortError(ERROR_CODES.INVALID, 'an order needs an orderNo');
  }
  if (!Array.isArray(order.items) || order.items.length === 0) {
    throw new PortError(ERROR_CODES.INVALID, 'an order needs at least one item');
  }
  return order;
}

/** A short, human-quotable order number. */
export function makeOrderNo(random = Math.random) {
  return `EL-${10000 + Math.floor(random() * 89999)}`;
}
