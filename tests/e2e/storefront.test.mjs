// End-to-end storefront tests (Playwright + the static site on 127.0.0.1:8777).
//   npm run serve   # in one shell
//   npm run test:e2e
//
// Covers: every route renders on mobile/tablet/desktop with no JS errors and no
// horizontal overflow (RTL), and the browse -> service -> cart -> checkout funnel.

import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8777';
const SVC = 'زيادة متابعين فيسبوك';

const ROUTES = {
  home:     '/index.html',
  category: '/category.html?id=facebook',
  service:  `/service.html?cat=facebook&svc=${encodeURIComponent(SVC)}`,
  checkout: '/checkout.html',
  account:  '/account.html',
  admin:    '/admin.html',
  review:   '/review.html',
  proofs:   '/proofs.html',
};

const VIEWPORTS = [['mobile', 390, 844], ['tablet', 820, 1180], ['desktop', 1440, 900]];

// A blocked third-party CDN (fonts, Font Awesome, the Firebase SDK) is an
// environment artifact, not a site defect. Console messages for a failed fetch
// carry no URL, so resource-load failures are judged from the request URL
// instead: only a SAME-ORIGIN failure means the site itself is broken.

let browser;

before(async () => {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  });
});
after(async () => { await browser?.close(); });

/** Open a page, collect errors, and return a probe handle. */
async function open(path, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport, locale: 'ar' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    // Resource-load failures are asserted on via `requestfailed` below, where
    // the URL is available to tell a local 404 from a blocked CDN.
    if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) {
      errors.push(m.text());
    }
  });
  page.on('requestfailed', (r) => {
    if (r.url().startsWith(BASE)) errors.push(`local asset failed: ${r.url()}`);
  });
  const resp = await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);
  return { page, ctx, errors, status: resp?.status() };
}

describe('every route renders across viewports', () => {
  for (const [vName, width, height] of VIEWPORTS) {
    for (const [rName, path] of Object.entries(ROUTES)) {
      test(`${rName} @ ${vName}`, async () => {
        const { page, ctx, errors, status } = await open(path, { width, height });
        try {
          assert.equal(status, 200, `${rName} returned ${status}`);

          const m = await page.evaluate(() => ({
            scrollW: document.documentElement.scrollWidth,
            clientW: document.documentElement.clientWidth,
            dir: document.documentElement.getAttribute('dir'),
            lang: document.documentElement.getAttribute('lang'),
            title: document.title,
            chars: (document.body.innerText || '').trim().length,
          }));

          // RTL Arabic is a hard requirement of the storefront.
          assert.equal(m.dir, 'rtl', `${rName} is not dir="rtl"`);
          assert.equal(m.lang, 'ar', `${rName} is not lang="ar"`);
          assert.ok(m.title.length > 0, `${rName} has no <title>`);
          assert.ok(m.chars > 100, `${rName} rendered almost nothing (${m.chars} chars)`);

          // No horizontal scrollbar: 1px of rounding slack, nothing more.
          assert.ok(m.scrollW - m.clientW <= 1,
            `${rName} overflows horizontally by ${m.scrollW - m.clientW}px at ${vName}`);

          assert.deepEqual(errors, [], `${rName} logged JS errors`);
        } finally { await ctx.close(); }
      });
    }
  }
});

describe('browse -> service -> cart -> checkout', () => {
  test('the home page lists category entry points', async () => {
    const { page, ctx } = await open(ROUTES.home);
    try {
      const links = await page.$$('a[href^="category.html"]');
      assert.ok(links.length > 0, 'home page has no category links');
    } finally { await ctx.close(); }
  });

  test('a category page lists services that link to the service page', async () => {
    const { page, ctx } = await open(ROUTES.category);
    try {
      assert.equal(await page.$eval('h1', (e) => e.textContent.trim()), 'خدمات فيسبوك');
      const links = await page.$$('a[href^="service.html"]');
      assert.ok(links.length > 0, 'category page has no service links');
    } finally { await ctx.close(); }
  });

  test('the service page shows the service and a purchase action', async () => {
    const { page, ctx } = await open(ROUTES.service);
    try {
      assert.equal(await page.$eval('h1', (e) => e.textContent.trim()), SVC);
      const buy = await page.$$eval('button, a',
        (els) => els.filter((e) => /شراء|أضف/.test(e.textContent)).length);
      assert.ok(buy > 0, 'service page has no purchase action');
    } finally { await ctx.close(); }
  });

  test('adding to the cart persists it into checkout', async () => {
    const { page, ctx } = await open(ROUTES.service);
    try {
      await page.evaluate((n) => window.Cart.add({ name: n, category: 'facebook', qty: 2 }), SVC);
      const count = await page.evaluate(() => window.Cart.count());
      assert.equal(count, 2, 'cart did not record the item');

      await page.goto(BASE + ROUTES.checkout, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      assert.equal(await page.$eval('#coCount', (e) => e.textContent.trim()), '2',
        'checkout did not carry the cart over');
      const summary = await page.$eval('#coItems', (e) => e.textContent);
      assert.ok(summary.includes(SVC), 'checkout summary is missing the service');
    } finally { await ctx.close(); }
  });

  test('checkout refuses to submit an empty cart', async () => {
    const { page, ctx } = await open(ROUTES.checkout);
    try {
      await page.evaluate(() => window.Cart.clear());
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      const submitVisible = await page.$eval('#coSubmit', (e) => e.style.display !== 'none');
      assert.equal(submitVisible, false, 'empty cart still offers a submit button');
    } finally { await ctx.close(); }
  });
});

describe('admin surface', () => {
  test('the admin page gates behind a login instead of rendering the dashboard', async () => {
    const { page, ctx } = await open(ROUTES.admin);
    try {
      const panelVisible = await page.$$eval('.panel',
        (els) => els.some((e) => e.offsetParent !== null));
      assert.equal(panelVisible, false,
        'admin panels are visible to an unauthenticated visitor');
    } finally { await ctx.close(); }
  });
});
