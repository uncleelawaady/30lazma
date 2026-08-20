# CLAUDE.md

Guidance for Claude Code (and other AI assistants) working in this repository.

## What this repo is

**Elwaset** (`الوسيط`) — an Arabic, right-to-left storefront for digital / social-media
services (followers, views, likes, channel members, bot building, design, etc.). It is a
**static site with no build step**: plain HTML + CSS + vanilla JS served directly, with
Firebase (Firestore / Auth / Storage) loaded at runtime from the gstatic CDN as ES modules.

- Deployed via **GitHub Pages** — `CNAME` pins the custom domain `newlynow.com`.
- **There is no `package.json`, no bundler, no test suite, no CI.** Pushing to `main`
  is the deploy. Do not introduce a build toolchain unless explicitly asked.
- `README.md` is stale: it describes an older personal-portfolio version of this repo.
  Trust the code, not the README.

The `bot_dev/` directory is an **unrelated Python Telegram bot** that happens to live in
the same repo (see [bot_dev](#bot_dev--separate-python-project)). It is not part of the site.

## Running locally

```bash
python -m http.server 8000     # then open http://localhost:8000
```

Opening `index.html` via `file://` mostly works but breaks the Firebase ES-module imports
and `URLSearchParams`-driven pages. Use the HTTP server.

There is nothing to install, lint, or test. Verification is manual: load the affected page
in a browser and check the console.

## Page map

| File | Role |
|---|---|
| `index.html` | Storefront home: hero, categories grid, featured services, reviews, proofs, CTA |
| `category.html?id=<catId>` | One category's full service list |
| `service.html?...` | One service's detail page with policy tabs |
| `checkout.html` | Cart review → writes order to Firestore → hands off to WhatsApp |
| `account.html` | Customer signup/login (Google, Facebook, email+password), profile, orders |
| `review.html` | Signed-in customers submit a review (lands `approved: false`) |
| `proofs.html` | Static proof/testimonial gallery with lightbox |
| `admin.html` | Owner/admin dashboard — single ~68KB self-contained page, 11 tabs |

## Shared scripts

Load order matters — most scripts are IIFEs that read globals set by earlier ones.
The canonical order used across storefront pages:

```html
<script src="script.js"></script>       <!-- nav, smooth scroll, reveal-on-scroll, counters, search -->
<script src="contact.js"></script>      <!-- WhatsApp/Messenger/Call chooser + floating FABs -->
<script src="firebase-config.js"></script>  <!-- window.FIREBASE_CONFIG -->
<script src="config.js"></script>       <!-- live site config: theme vars, texts, section visibility -->
<script src="auth.js"></script>         <!-- navbar account link + notifications bell -->
<script src="cart.js"></script>         <!-- window.Cart + drawer/FAB/toast -->
<script src="data.js"></script>         <!-- window.CATEGORIES, window.DETAILS, faIcon(), catDesc() -->
<script src="catalog.js"></script>      <!-- window.getCatalog() -> Firestore catalog -->
<script src="widgets.js"></script>      <!-- top ticker + services marquee (needs CATEGORIES) -->
<script src="coverflow.js"></script>    <!-- 3D coverflow carousel (needs CATEGORIES) -->
```

Globals published on `window`: `FIREBASE_CONFIG`, `SITE_CONFIG`, `CATEGORIES`, `DETAILS`,
`faIcon`, `catDesc`, `getCatalog`, `Cart`, `ElwasetContact`.

## Content & config data flow

Content is **defaults in code, overridden live from Firestore** so the owner can edit the
store from `admin.html` without a deploy.

1. `data.js` ships the built-in `window.CATEGORIES` / `window.DETAILS` — always present,
   so the site renders even offline or if Firebase is unreachable.
2. `catalog.js` exposes `window.getCatalog()` which reads `config/catalog` (field
   `categories`) from Firestore, caches it in `localStorage.elwasetCatalog`, and returns
   the cache on any failure.
3. Consumer pages merge over the defaults, never replace them:
   ```js
   const cat = await Promise.race([window.getCatalog(), new Promise(r => setTimeout(() => r(null), 1800))]);
   if (cat) window.CATEGORIES = Object.assign({}, window.CATEGORIES, cat);
   ```
   **Keep the 1800 ms race** — a slow Firestore must never block first render.
4. `config.js` subscribes with `onSnapshot` to `config/site` and applies it live:
   - `c.theme` → CSS custom properties on `<html>` (`--bg`, `--grad-from`, …)
   - `c.texts` → `textContent` of every `[data-k="<key>"]` element
   - `c.hidden` → hides sections by id (known ids: `founder`, `categories`, `featured`,
     `portfolio`, `testimonials`, `proofs`, `payments`, `partners`)
   - `c.ticker`, `c.contact`, `c.policies`, `c.admins`, `c.unifyCats`
   It applies the `localStorage.elwasetConfig` cache **synchronously first** to avoid a
   flash of default theme, then re-applies on each snapshot, and dispatches a
   `siteconfig` CustomEvent on `document` that `widgets.js` listens for.

A category object looks like:

```js
"tiktok": {
  icon: "fa-tiktok", g1: "#0E7A45", g2: "#17C8AC",   // gradient stops
  title: "خدمات تيك توك",
  intro: "…",
  img, active, order,                                 // Firestore-managed extras
  groups: [{ h: "خدمات تيك توك", items: ["زيادة متابعين تيك توك", …] }]
}
```

Use `window.faIcon(slug)` rather than hardcoding `fas`/`fab` — brand icons need
`fa-brands`, and it passes through full class strings untouched.

## Firebase

Project `elwaset-store`. `firebase-config.js` holds the public web config — that key is
meant to be client-side, so **don't treat it as a leaked secret**; access is controlled by
the rules files instead.

Firebase is imported dynamically per script, each with its own named app instance to avoid
double-init (`cfgApp`, `notifApp`, `catApp`):

```js
const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
```

Pin new imports to the **same 10.12.0** version already used everywhere.

### Collections

| Path | Written by | Read by |
|---|---|---|
| `config/site` | admin | every page (theme, texts, policies, contact, admins, ticker) |
| `config/catalog` | admin | `catalog.js` |
| `orders` | `checkout.html` (anyone) | admin |
| `customers` | checkout / account / review | admin; user writes own doc |
| `users` | `account.html` (own uid) | admin |
| `reviews` | anyone (`approved: false`) | public; admin moderates |
| `announcements` | admin | `auth.js` bell, `account.html` |

### Access model

`firestore.rules` defines two tiers:

- **Owners** — hardcoded emails `elawaady.official@gmail.com` and
  `elawadi.store4@gmail.com`. Full control, and only owners see the "المشرفين" tab.
- **Admins** — any email listed in `config/site.admins`. Can manage the store, not admins.

`admin.html` mirrors this list in its own `OWNERS` constant, and `storage.rules` allows
writes only from `elawaady.official@gmail.com`. **Changing the owner set means editing all
three places** — `firestore.rules`, `storage.rules`, and the `OWNERS` array in `admin.html`
— then deploying the rules to Firebase (rules in this repo are source-of-truth copies; a
`git push` does not deploy them).

Rules are deliberately permissive on create (`orders`, `reviews`, `customers` accept
unauthenticated writes) because checkout has no login step. Keep it that way unless asked.

## Conventions

**Language.** All user-facing copy is Arabic (Egyptian dialect), pages are
`dir="rtl" lang="ar"`. Match the existing tone; keep code comments in English.

**Style.** Every shared script is an IIFE. No frameworks, no modules for site scripts
(only the Firebase imports are ESM). Two-space indent in the newer JS files;
`index.html`/`script.js` use four — follow whatever the file already does.

**Escaping.** Everything is rendered with string concatenation into `innerHTML`. Each file
defines its own local `esc()` helper. **Any interpolated value must go through `esc()`** —
this is the only XSS defense in the codebase. Copy the helper into new files rather than
importing.

**Fail-soft everywhere.** Firestore calls are wrapped in `try/catch` that falls back to the
localStorage cache or the `data.js` defaults, usually silently. Checkout saves the order
best-effort and then redirects to WhatsApp regardless. Preserve this: a Firebase outage must
degrade the store, not break it.

**Cache busting.** Stylesheets are versioned by query string — `style.css?v=4`,
`strx-theme.css?v=1`. **When you change a CSS file, bump its `?v=` across every HTML file
that links it** (`index`, `category`, `service`, `checkout`, `account`, `review`, `proofs`).

**CSS layering.** `style.css` (~69KB) is the base — dark Higgsfield-style theme, all tokens
in `:root`. `strx-theme.css` loads *after* and re-skins the store to white background /
black cards using `!important` overrides. Structural changes go in `style.css`; pure colour
and surface changes go in `strx-theme.css`. Firestore `theme` values override both at
runtime via inline custom properties.

**localStorage keys.** `elwaset_cart`, `elwaset_fav`, `elwasetConfig`, `elwasetCatalog`,
`annSeen`.

**Contact details** are duplicated: WhatsApp `201055578777` and phone `201008002333`
appear in `contact.js` (`CFG`, overridable from `config/site.contact`) and are hardcoded
again in `script.js`, `category.html`, `service.html`, and `checkout.html`. Update all of
them together, or route through `window.ElwasetContact`.

**`data-k` is overloaded.** `config.js` rewrites the `textContent` of any `[data-k]`
element from `config/site.texts`. `service.html` also uses `data-k` on its policy tab
buttons and panes (`desc`, `feat`, `req`, `terms`, `returns`, `refund`, `service`) purely
for tab switching. Don't add a site-text key that collides with those names, or the tabs
will have their labels overwritten.

## admin.html

One self-contained page, ~1000 lines of inline ESM. Tabs: theme, texts, catalog, sections,
contact, orders, policies, reviews, notify, users, admins (owner-only). Auth is Google
popup **or** email+password, with a self-service owner-signup path gated on the `OWNERS`
list. Writes go to `config/site` and `config/catalog` with `{ merge: true }` — except the
catalog save, which uses `merge: false` so deletions actually stick.

Editable text keys live in the `TEXT_KEYS` array near the top of the module; adding a new
editable string means adding it there **and** tagging the storefront element with the
matching `data-k`.

## bot_dev/ — separate Python project

`@exd_downloader_bot`, a TikTok/YouTube downloader Telegram bot (`python-telegram-bot`
20.7 + `yt-dlp`, SQLite). Has its own `README.md`, `DEPLOYMENT_GUIDE.md`, and
`.env.example`. Independent of the website — changes there never affect the store, and
vice versa. Its admin id is hardcoded in `enhanced_bot.py`.

## Git workflow

- Default branch: `main`. Pushing to it publishes the live site.
- Commit messages in this repo are short, imperative, English one-liners
  (e.g. `Switch re-skin to white background + black cards (no turquoise)`).
- Do not commit real secrets. `firebase-config.js` is intentionally public;
  `HOSTINGER_API_TOKEN` (referenced by `.claude/settings.json`) and `BOT_TOKEN` are not —
  keep those in the environment.

## Gotchas

- Editing `data.js` changes only the **fallback** catalog. If Firestore `config/catalog`
  exists, it wins on every page for the keys it defines. Test with the cache cleared.
- `widgets.js` and `coverflow.js` read `window.CATEGORIES` at load time, so they render the
  `data.js` defaults, not the Firestore catalog. Only the home grid, `category.html`, and
  `service.html` do the async merge.
- `localStorage.elwasetConfig` / `elwasetCatalog` make stale content survive a hard refresh.
  Clear site data when a change "doesn't appear".
- Firestore listing queries fall back from `orderBy('createdAt')` to an unordered
  `collection()` read when the index is missing — sorting may silently disappear.
- `script.js` assumes `#nav` exists (unguarded `nav.style.boxShadow` in a scroll handler).
  Both pages that load it — `index.html` and `proofs.html` — have that element; adding
  `script.js` to a page without a `<nav id="nav">` will throw on first scroll.
