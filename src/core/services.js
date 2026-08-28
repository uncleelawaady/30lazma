// ===== Elwaset — service model =====
//
// A service used to be a bare string in `category.groups[].items[]`, with a few
// loose extras hanging off `category.details[name]` (`p`, `d`, `img`...). That
// is not enough to describe a sellable service: no pre-discount price, no
// duration, no warranty, no instructions, no customer fields, no packages, and
// no service type.
//
// This module is the single definition of what a service is. It normalises the
// legacy shapes so nothing already stored breaks, fills in sane defaults, and
// exposes the derived values (discount, effective price) that the storefront
// and the dashboard both need. Every page reads services through here rather
// than poking at `details[name]` directly.
//
// Pure business logic: no Firebase, no DOM, no network. It must stay that way —
// this is the layer that survives a move from Firestore to MySQL untouched.


// ---- vocabularies -------------------------------------------------------

// Condition 10: the six kinds of thing this store can sell.
const TYPES = {
  manual:       { id: 'manual',       label: 'تنفيذ يدوي',      auto: false },
  api:          { id: 'api',          label: 'تلقائي / API',    auto: true  },
  digital:      { id: 'digital',      label: 'منتج رقمي',       auto: true  },
  subscription: { id: 'subscription', label: 'اشتراك',          auto: false },
  account:      { id: 'account',      label: 'حساب جاهز',       auto: true  },
  custom:       { id: 'custom',       label: 'خدمة مخصصة',      auto: false },
};
const DEFAULT_TYPE = 'manual';

// Input types a service may ask the customer for.
const FIELD_TYPES = ['text', 'url', 'number', 'email', 'tel', 'textarea', 'select'];

// ---- helpers ------------------------------------------------------------

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (v == null ? '' : String(v)).trim();
const arr = (v) => (Array.isArray(v) ? v : []);

/**
 * Money in this catalog has always been free text ("50 جنيه", "حسب الطلب").
 * Return a number when one can be read out of the value, otherwise null —
 * so a legacy string still displays while arithmetic stays honest.
 */
function toAmount(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = str(v);
  if (!s) return null;
  // Accept Arabic-Indic digits alongside Latin ones.
  const latin = s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
                 .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
  const m = latin.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

const boolOr = (v, fallback) => (typeof v === 'boolean' ? v : fallback);

// Legacy heuristics kept from admin.html so existing rows behave the same.
const QTY_RE  = /متابع|لايك|مشاهد|مشترك|عضو|تعليق|ريتويت|مشارك|شير|حفظ|ساعات|زيارة|نقاط|رشق/;
const LINK_RE = /متابع|لايك|مشاهد|مشترك|عضو|تعليق|ريتويت|مشارك|شير|حفظ|ساعات|بث|ستوري|ريلز|بوست|منشور/;

// ---- customer fields ----------------------------------------------------

function normalizeField(raw, i) {
  const f = isObj(raw) ? raw : { label: str(raw) };
  const type = FIELD_TYPES.includes(f.type) ? f.type : 'text';
  return {
    key: str(f.key) || `field_${i + 1}`,
    label: str(f.label) || `حقل ${i + 1}`,
    type,
    required: boolOr(f.required, true),
    placeholder: str(f.placeholder),
    options: type === 'select' ? arr(f.options).map(str).filter(Boolean) : [],
  };
}

/**
 * The customer fields a service asks for. When none are configured the legacy
 * `needLink` flag still produces the account-link field the store has always
 * shown, so an un-migrated service keeps its behaviour.
 */
function normalizeFields(raw, { needLink }) {
  const fields = arr(raw).map(normalizeField);
  if (fields.length) return fields;
  return needLink
    ? [{ key: 'link', label: 'رابط الحساب / المنشور', type: 'url',
         required: true, placeholder: 'https://', options: [] }]
    : [];
}

// ---- packages -----------------------------------------------------------

function normalizePackage(raw, i) {
  const p = isObj(raw) ? raw : { label: str(raw) };
  const price = toAmount(p.price);
  const priceBefore = toAmount(p.priceBefore != null ? p.priceBefore : p.was);
  return {
    id: str(p.id) || `pkg_${i + 1}`,
    label: str(p.label) || `الباقة ${i + 1}`,
    price,
    priceText: str(p.price) || (price != null ? String(price) : ''),
    priceBefore,
    qty: toAmount(p.qty),
    duration: str(p.duration),
    desc: str(p.desc),
    discountPercent: discountPercent(price, priceBefore),
  };
}

/** Whole percent off, or null when there is no genuine discount. */
function discountPercent(price, priceBefore) {
  if (price == null || priceBefore == null) return null;
  if (priceBefore <= 0 || price >= priceBefore) return null;
  return Math.round(((priceBefore - price) / priceBefore) * 100);
}

// ---- the model ----------------------------------------------------------

/**
 * Build a full service record.
 *
 * @param {string} name    service name (the catalog key)
 * @param {object} detail  the `category.details[name]` entry, any legacy shape
 * @param {object} ctx     { categoryId, categoryTitle, group }
 */
function normalize(name, detail, ctx) {
  const d = isObj(detail) ? detail : {};
  const c = isObj(ctx) ? ctx : {};
  const serviceName = str(name) || str(d.name);

  // `p` and `d`/`desc` are the legacy field names; keep reading them.
  const priceText = str(d.price != null ? d.price : d.p);
  const price = toAmount(priceText);
  const priceBefore = toAmount(d.priceBefore != null ? d.priceBefore : d.was);

  const needQty  = boolOr(d.needQty,  QTY_RE.test(serviceName));
  const needLink = boolOr(d.needLink, LINK_RE.test(serviceName));

  const packages = arr(d.packages).map(normalizePackage);

  return {
    // identity
    name: serviceName,
    code: str(d.code) || autoCode(serviceName, c.categoryId),
    categoryId: str(c.categoryId),
    categoryTitle: str(c.categoryTitle),
    subcategory: str(c.group || d.subcategory),

    // presentation
    desc: str(d.d || d.desc) || defaultDesc(serviceName, c.categoryTitle),
    longDesc: str(d.longDesc),
    img: str(d.img),
    gallery: [str(d.img)].concat(arr(d.gallery).map(str)).filter(Boolean),

    // commerce
    type: TYPES[str(d.type)] ? str(d.type) : DEFAULT_TYPE,
    price,
    priceText: priceText || '',
    priceBefore,
    priceBeforeText: priceBefore != null ? String(priceBefore) : '',
    currency: str(d.currency) || 'EGP',
    discountPercent: discountPercent(price, priceBefore),

    // fulfilment promises shown on the service page
    duration: str(d.duration),
    warranty: str(d.warranty),
    instructions: str(d.instructions),

    // what we need from the customer
    needQty,
    needLink,
    min: toAmount(d.min),
    max: toAmount(d.max),
    step: toAmount(d.step),
    fields: normalizeFields(d.fields, { needLink }),
    packages,

    // catalog state
    active: boolOr(d.active, true),
    order: toAmount(d.order) || 0,
    tags: arr(d.tags).map(str).filter(Boolean),
  };
}

function defaultDesc(name, categoryTitle) {
  if (!name) return '';
  const inCat = categoryTitle ? ` ضمن قسم ${categoryTitle}` : '';
  return `خدمة «${name}»${inCat} — نوفرها بجودة عالية وتنفيذ آمن وسريع، مع دعم كامل ومتابعة حتى تمام الرضا.`;
}

/** Stable per-service code, so the same service always shows the same one. */
function autoCode(name, categoryId) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  const prefix = str(categoryId).slice(0, 3).toUpperCase() || 'SVC';
  return `EL-${prefix}-${String(Math.abs(h)).slice(0, 4).padStart(4, '0')}`;
}

/** Every service in a category, in catalog order, normalised. */
function fromCategory(categoryId, category) {
  const c = isObj(category) ? category : {};
  const details = isObj(c.details) ? c.details : {};
  const globalDetails = isObj(typeof DETAILS_REF === 'undefined' ? null : DETAILS_REF) ? DETAILS_REF : {};
  const out = [];
  arr(c.groups).forEach((g) => {
    arr(g && g.items).forEach((item) => {
      const name = isObj(item) ? str(item.name) : str(item);
      if (!name) return;
      const merged = Object.assign({},
        globalDetails[name] || {},
        details[name] || {},
        isObj(item) ? item : {});
      out.push(normalize(name, merged, {
        categoryId,
        categoryTitle: c.title,
        group: g && g.h,
      }));
    });
  });
  return out;
}

/** Look one service up by name within a category. */
function find(categoryId, category, name) {
  const wanted = str(name);
  return fromCategory(categoryId, category).find((s) => s.name === wanted) || null;
}

// `DETAILS_REF` resolves to the page-global legacy detail map when present.
let DETAILS_REF = null;
function useGlobalDetails(map) { DETAILS_REF = isObj(map) ? map : null; }

// ---- validation (used by the dashboard before saving) -------------------

/** @returns {string[]} human-readable problems; empty means valid. */
function validate(service) {
  const s = isObj(service) ? service : {};
  const errors = [];

  if (!str(s.name)) errors.push('اسم الخدمة مطلوب.');
  if (str(s.name).length > 200) errors.push('اسم الخدمة طويل جدًا (الحد 200 حرف).');
  if (s.type && !TYPES[s.type]) errors.push(`نوع خدمة غير معروف: ${s.type}`);

  const price = toAmount(s.price != null ? s.price : s.priceText);
  const before = toAmount(s.priceBefore);
  if (price != null && price < 0) errors.push('السعر لا يمكن أن يكون سالبًا.');
  if (before != null && price != null && before <= price) {
    errors.push('السعر قبل الخصم يجب أن يكون أكبر من السعر الحالي.');
  }

  const min = toAmount(s.min), max = toAmount(s.max);
  if (min != null && max != null && min > max) {
    errors.push('أقل كمية أكبر من أكبر كمية.');
  }

  const keys = new Set();
  arr(s.fields).forEach((f, i) => {
    const key = str(f && f.key);
    if (!key) { errors.push(`الحقل رقم ${i + 1} بدون مُعرّف.`); return; }
    if (keys.has(key)) errors.push(`مُعرّف حقل مكرر: ${key}`);
    keys.add(key);
    if (f.type && !FIELD_TYPES.includes(f.type)) {
      errors.push(`نوع حقل غير معروف: ${f.type}`);
    }
    if (f.type === 'select' && !arr(f.options).length) {
      errors.push(`الحقل «${str(f.label) || key}» من نوع قائمة بدون خيارات.`);
    }
  });

  arr(s.packages).forEach((p, i) => {
    const pp = toAmount(p && p.price);
    const pb = toAmount(p && p.priceBefore);
    if (pp != null && pp < 0) errors.push(`سعر الباقة رقم ${i + 1} سالب.`);
    if (pb != null && pp != null && pb <= pp) {
      errors.push(`الباقة رقم ${i + 1}: السعر قبل الخصم يجب أن يكون أكبر من السعر.`);
    }
  });

  return errors;
}

/**
 * The immutable record an order keeps (condition 9): everything needed to
 * reprint the order later, frozen at purchase time, so editing the service
 * afterwards cannot change what the customer bought.
 *
 * Selling price only — cost and markup are supplier data and never leave the
 * server.
 */
function snapshot(service, { qty = 1, packageId = '', inputs = {} } = {}) {
  const s = normalize(service && service.name, service, {
    categoryId: service && service.categoryId,
    categoryTitle: service && service.categoryTitle,
  });
  const pkg = s.packages.find((p) => p.id === packageId) || null;
  const unit = pkg ? pkg.price : s.price;
  const quantity = Math.max(1, Math.floor(toAmount(qty) || 1));

  return {
    name: s.name,
    code: s.code,
    categoryId: s.categoryId,
    categoryTitle: s.categoryTitle,
    type: s.type,
    packageId: pkg ? pkg.id : '',
    packageLabel: pkg ? pkg.label : '',
    unitPrice: unit,
    unitPriceText: unit != null ? String(unit) : (s.priceText || 'حسب الطلب'),
    priceBefore: pkg ? pkg.priceBefore : s.priceBefore,
    currency: s.currency,
    qty: quantity,
    lineTotal: unit != null ? Math.round(unit * quantity * 100) / 100 : null,
    duration: s.duration,
    warranty: s.warranty,
    inputs: isObj(inputs) ? inputs : {},
  };
}

export {
TYPES, FIELD_TYPES, DEFAULT_TYPE,
normalize, fromCategory, find, validate, snapshot,
toAmount, discountPercent, useGlobalDetails,
};

export default {
TYPES, FIELD_TYPES, DEFAULT_TYPE,
normalize, fromCategory, find, validate, snapshot,
toAmount, discountPercent, useGlobalDetails,
};
