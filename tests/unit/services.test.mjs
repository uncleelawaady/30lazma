// Unit tests for the service model (services.js).
// Covers conditions 7 (service page fields), 9 (order snapshot),
// 10 (service types) and the backward compatibility of the legacy catalog.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as Services from '../../src/core/services.js';

const CTX = { categoryId: 'facebook', categoryTitle: 'خدمات فيسبوك' };
const svc = (detail, name = 'زيادة متابعين فيسبوك') => Services.normalize(name, detail, CTX);

describe('backward compatibility with the existing catalog', () => {
  test('a bare service name still produces a usable service', () => {
    const s = svc(undefined);
    assert.equal(s.name, 'زيادة متابعين فيسبوك');
    assert.equal(s.type, 'manual');
    assert.ok(s.desc.length > 0, 'a description is generated');
    assert.ok(s.code.startsWith('EL-FAC-'));
    assert.equal(s.active, true);
  });

  test('the legacy `p` and `d` field names are still read', () => {
    const s = svc({ p: '50 جنيه', d: 'وصف قديم' });
    assert.equal(s.priceText, '50 جنيه');
    assert.equal(s.price, 50);
    assert.equal(s.desc, 'وصف قديم');
  });

  test('a free-text price is preserved as text and yields no amount', () => {
    const s = svc({ price: 'حسب الطلب' });
    assert.equal(s.priceText, 'حسب الطلب');
    assert.equal(s.price, null);
    assert.equal(s.discountPercent, null);
  });

  test('Arabic-Indic digits are read as numbers', () => {
    assert.equal(Services.toAmount('٥٠ جنيه'), 50);
    assert.equal(Services.toAmount('۱۲۵'), 125);
    assert.equal(Services.toAmount('1,250 EGP'), 1250);
  });

  test('the legacy needQty/needLink heuristics are unchanged', () => {
    assert.equal(svc(undefined, 'زيادة متابعين فيسبوك').needQty, true);
    assert.equal(svc(undefined, 'تصميم شعار').needQty, false);
    assert.equal(svc(undefined, 'لايكات إنستجرام').needLink, true);
    // an explicit flag always wins over the guess
    assert.equal(svc({ needQty: false }, 'زيادة متابعين فيسبوك').needQty, false);
  });

  test('the same service always gets the same code', () => {
    assert.equal(svc(undefined).code, svc(undefined).code);
    assert.notEqual(svc(undefined).code, svc(undefined, 'خدمة تانية').code);
  });

  test('an explicit code overrides the generated one', () => {
    assert.equal(svc({ code: 'MY-CODE' }).code, 'MY-CODE');
  });
});

describe('condition 7 — the service page needs every field', () => {
  test('pre-discount price and the derived discount', () => {
    const s = svc({ price: 60, priceBefore: 100 });
    assert.equal(s.price, 60);
    assert.equal(s.priceBefore, 100);
    assert.equal(s.discountPercent, 40);
  });

  test('no discount is reported when the "before" price is not higher', () => {
    assert.equal(svc({ price: 100, priceBefore: 100 }).discountPercent, null);
    assert.equal(svc({ price: 100, priceBefore: 80 }).discountPercent, null);
    assert.equal(svc({ price: 100 }).discountPercent, null);
  });

  test('duration, warranty and instructions round-trip', () => {
    const s = svc({ duration: '1-3 ساعات', warranty: 'ضمان 30 يوم', instructions: 'ابعت الرابط' });
    assert.equal(s.duration, '1-3 ساعات');
    assert.equal(s.warranty, 'ضمان 30 يوم');
    assert.equal(s.instructions, 'ابعت الرابط');
  });

  test('the gallery starts with the main image and drops blanks', () => {
    const s = svc({ img: 'a.png', gallery: ['b.png', '', 'c.png'] });
    assert.deepEqual(s.gallery, ['a.png', 'b.png', 'c.png']);
    assert.deepEqual(svc({}).gallery, []);
  });

  test('customer fields are normalised with defaults', () => {
    const s = svc({ fields: [{ key: 'link', label: 'الرابط', type: 'url' }, 'ملاحظات'] });
    assert.equal(s.fields.length, 2);
    assert.equal(s.fields[0].type, 'url');
    assert.equal(s.fields[0].required, true);
    assert.equal(s.fields[1].key, 'field_2');
    assert.equal(s.fields[1].type, 'text');
  });

  test('an unknown field type falls back to text', () => {
    assert.equal(svc({ fields: [{ key: 'x', type: 'sql' }] }).fields[0].type, 'text');
  });

  test('select options survive; non-select options are dropped', () => {
    const s = svc({ fields: [
      { key: 'plan', type: 'select', options: ['شهري', 'سنوي'] },
      { key: 'note', type: 'text', options: ['ignored'] },
    ] });
    assert.deepEqual(s.fields[0].options, ['شهري', 'سنوي']);
    assert.deepEqual(s.fields[1].options, []);
  });

  test('an un-migrated service with needLink still asks for the link', () => {
    const s = svc(undefined, 'لايكات إنستجرام');
    assert.equal(s.fields.length, 1);
    assert.equal(s.fields[0].key, 'link');
    assert.equal(s.fields[0].type, 'url');
  });

  test('a service that needs no link asks for nothing by default', () => {
    assert.deepEqual(svc(undefined, 'تصميم شعار').fields, []);
  });

  test('packages carry their own price, discount and duration', () => {
    const s = svc({ packages: [
      { id: 'p1', label: '1000 متابع', price: 90, priceBefore: 120, qty: 1000, duration: 'يوم' },
      { label: '5000 متابع', price: 400 },
    ] });
    assert.equal(s.packages.length, 2);
    assert.equal(s.packages[0].discountPercent, 25);
    assert.equal(s.packages[0].qty, 1000);
    assert.equal(s.packages[1].id, 'pkg_2');
    assert.equal(s.packages[1].discountPercent, null);
  });
});

describe('condition 10 — service types', () => {
  test('all six types are defined', () => {
    assert.deepEqual(Object.keys(Services.TYPES).sort(),
      ['account', 'api', 'custom', 'digital', 'manual', 'subscription']);
  });

  test('each type declares whether it can be fulfilled automatically', () => {
    assert.equal(Services.TYPES.api.auto, true);
    assert.equal(Services.TYPES.manual.auto, false);
    assert.equal(Services.TYPES.subscription.auto, false);
  });

  test('a known type is kept and an unknown one falls back to manual', () => {
    assert.equal(svc({ type: 'api' }).type, 'api');
    assert.equal(svc({ type: 'nonsense' }).type, 'manual');
    assert.equal(svc({}).type, 'manual');
  });
});

describe('reading a whole category', () => {
  const category = {
    title: 'خدمات فيسبوك',
    details: { 'لايكات فيسبوك': { price: 20, type: 'api' } },
    groups: [
      { h: 'التفاعل', items: ['لايكات فيسبوك', 'تعليقات فيسبوك'] },
      { h: 'المتابعين', items: [{ name: 'متابعين صفحة', price: 75, duration: 'ساعة' }] },
    ],
  };

  test('every service across every group is returned in order', () => {
    const list = Services.fromCategory('facebook', category);
    assert.deepEqual(list.map((s) => s.name),
      ['لايكات فيسبوك', 'تعليقات فيسبوك', 'متابعين صفحة']);
  });

  test('a service carries its group as its subcategory', () => {
    const list = Services.fromCategory('facebook', category);
    assert.equal(list[0].subcategory, 'التفاعل');
    assert.equal(list[2].subcategory, 'المتابعين');
  });

  test('details are merged and an inline object item wins', () => {
    const list = Services.fromCategory('facebook', category);
    assert.equal(list[0].price, 20);
    assert.equal(list[0].type, 'api');
    assert.equal(list[2].price, 75);
    assert.equal(list[2].duration, 'ساعة');
  });

  test('find() locates one service, or null', () => {
    assert.equal(Services.find('facebook', category, 'لايكات فيسبوك').price, 20);
    assert.equal(Services.find('facebook', category, 'مش موجودة'), null);
  });

  test('a malformed category yields an empty list rather than throwing', () => {
    assert.deepEqual(Services.fromCategory('x', null), []);
    assert.deepEqual(Services.fromCategory('x', { groups: [null, { items: [''] }] }), []);
  });
});

describe('validation', () => {
  const ok = (s) => assert.deepEqual(Services.validate(s), []);
  const fails = (s, needle) => {
    const errs = Services.validate(s);
    assert.ok(errs.length > 0, 'expected a validation error');
    if (needle) assert.ok(errs.some((e) => e.includes(needle)), `expected an error about ${needle}, got ${errs.join(' | ')}`);
  };

  test('a minimal service is valid', () => ok({ name: 'خدمة' }));
  test('a name is required', () => fails({ name: '' }, 'اسم الخدمة مطلوب'));
  test('an over-long name is rejected', () => fails({ name: 'x'.repeat(201) }));
  test('an unknown type is rejected', () => fails({ name: 'خدمة', type: 'weird' }, 'نوع خدمة'));
  test('a negative price is rejected', () => fails({ name: 'خدمة', price: -5 }));
  test('a pre-discount price must exceed the price', () =>
    fails({ name: 'خدمة', price: 100, priceBefore: 90 }, 'قبل الخصم'));
  test('a valid discount passes', () => ok({ name: 'خدمة', price: 90, priceBefore: 100 }));
  test('min above max is rejected', () => fails({ name: 'خدمة', min: 100, max: 10 }));
  test('duplicate field keys are rejected', () =>
    fails({ name: 'خدمة', fields: [{ key: 'a' }, { key: 'a' }] }, 'مكرر'));
  test('a select with no options is rejected', () =>
    fails({ name: 'خدمة', fields: [{ key: 'a', type: 'select', options: [] }] }, 'خيارات'));
  test('a package priced below zero is rejected', () =>
    fails({ name: 'خدمة', packages: [{ price: -1 }] }));
});

describe('condition 9 — the order snapshot', () => {
  const service = Services.normalize('لايكات فيسبوك', {
    price: 20, priceBefore: 30, duration: 'ساعة', warranty: 'ضمان 7 أيام',
    packages: [{ id: 'p1', label: '5000', price: 80, priceBefore: 100 }],
  }, CTX);

  test('it freezes what the customer bought, including the line total', () => {
    const snap = Services.snapshot(service, { qty: 3 });
    assert.equal(snap.name, 'لايكات فيسبوك');
    assert.equal(snap.unitPrice, 20);
    assert.equal(snap.priceBefore, 30);
    assert.equal(snap.qty, 3);
    assert.equal(snap.lineTotal, 60);
    assert.equal(snap.currency, 'EGP');
    assert.equal(snap.duration, 'ساعة');
    assert.equal(snap.warranty, 'ضمان 7 أيام');
  });

  test('a chosen package overrides the base price', () => {
    const snap = Services.snapshot(service, { qty: 2, packageId: 'p1' });
    assert.equal(snap.packageId, 'p1');
    assert.equal(snap.packageLabel, '5000');
    assert.equal(snap.unitPrice, 80);
    assert.equal(snap.lineTotal, 160);
  });

  test('editing the service afterwards does not change an existing snapshot', () => {
    const snap = Services.snapshot(service, { qty: 1 });
    service.price = 999;
    service.warranty = 'تغيّر';
    assert.equal(snap.unitPrice, 20);
    assert.equal(snap.warranty, 'ضمان 7 أيام');
  });

  test('an unpriced service snapshots as "حسب الطلب" with no total', () => {
    const s = Services.normalize('خدمة مخصصة', { price: 'حسب الطلب' }, CTX);
    const snap = Services.snapshot(s, { qty: 2 });
    assert.equal(snap.unitPrice, null);
    assert.equal(snap.lineTotal, null);
    assert.equal(snap.unitPriceText, 'حسب الطلب');
  });

  test('quantity is coerced to a sane whole number', () => {
    assert.equal(Services.snapshot(service, { qty: 0 }).qty, 1);
    assert.equal(Services.snapshot(service, { qty: -4 }).qty, 1);
    assert.equal(Services.snapshot(service, { qty: 2.7 }).qty, 2);
  });

  test('customer inputs are carried into the snapshot', () => {
    const snap = Services.snapshot(service, { qty: 1, inputs: { link: 'https://x' } });
    assert.deepEqual(snap.inputs, { link: 'https://x' });
  });

  test('the snapshot never carries supplier cost or markup', () => {
    const snap = Services.snapshot(service, { qty: 1 });
    for (const k of ['cost', 'markup', 'profit', 'providerId', 'apiKey']) {
      assert.ok(!(k in snap), `snapshot leaked ${k}`);
    }
  });
});
