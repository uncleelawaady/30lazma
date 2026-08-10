import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const fail = [];
const warn = [];
const exists = p => fs.existsSync(path.join(root, p));
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const walk = (dir='.') => fs.readdirSync(path.join(root,dir), {withFileTypes:true}).flatMap(e => {
  const p = path.posix.join(dir === '.' ? '' : dir, e.name);
  if (['.git','node_modules'].includes(e.name)) return [];
  return e.isDirectory() ? walk(p) : [p];
});
const files = walk();

for (const file of files.filter(f => /\.m?js$/i.test(f))) {
  try { execFileSync(process.execPath, ['--check', file], { cwd: root, stdio:'pipe' }); }
  catch (e) { fail.push(`JavaScript syntax error: ${file}\n${String(e.stderr || e.message)}`); }
}

for (const file of files.filter(f => /\.html$/i.test(f))) {
  const html = read(file);
  const refs = [...html.matchAll(/(?:src|href)=["']([^"'#?]+)(?:\?[^"']*)?["']/gi)].map(m => m[1]);
  for (const ref of refs) {
    if (/^(?:https?:|data:|mailto:|tel:|\/\/)/i.test(ref)) continue;
    const local = path.posix.normalize(path.posix.join(path.posix.dirname(file), ref));
    if (/\.(?:js|css)$/i.test(local) && !exists(local)) fail.push(`${file} references missing local asset: ${local}`);
  }
}

const forbiddenFiles = files.filter(f => /(^|\/)\.env$/i.test(f) || /service[-_]?account.*\.json$/i.test(f) || /firebase-adminsdk/i.test(f));
forbiddenFiles.forEach(f => fail.push(`Private secret file must not be committed: ${f}`));

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:STRIPE|KASHIER|BINANCE|PAYMENT|WEBHOOK|HOSTINGER)[A-Z0-9_]*(?:SECRET|PRIVATE|TOKEN)\s*[:=]\s*["'][^"'${][^"']{8,}["']/i,
  /sk_(?:live|test)_[A-Za-z0-9]{16,}/,
];
for (const file of files.filter(f => /\.(?:js|mjs|json|html|yml|yaml|md|txt)$/i.test(f))) {
  if (/\.example$/i.test(file)) continue;
  const text = read(file);
  for (const re of secretPatterns) if (re.test(text)) fail.push(`Possible private secret in ${file}: ${re}`);
}

const browserCode = files.filter(f => /\.(?:js|html)$/i.test(f) && !f.startsWith('functions/'));
for (const file of browserCode) {
  const text = read(file);
  if (/admin-payments\.js$/.test(file)) continue;
  if (/paymentStatus\s*[:=]\s*["']paid["']/i.test(text) || /status\s*[:=]\s*["']paid["']/i.test(text)) {
    fail.push(`Client-side paid-state assignment is forbidden: ${file}`);
  }
}

if (exists('functions/index.js')) {
  const backend = read('functions/index.js');
  if (!/X-Firebase-AppCheck/.test(backend) || !/verifyToken\(/.test(backend)) fail.push('Payment backend must verify Firebase App Check tokens.');
  if (!/verifyWebhook\(/.test(backend)) fail.push('Payment backend must call provider webhook verification.');
  if (!/webhookEvents/.test(backend)) fail.push('Payment webhook must include an idempotency/event ledger.');
  if (!/calculateOrderPrice\(/.test(backend)) fail.push('Automatic payments must use server-authoritative structured pricing.');
  if (!/WEBHOOK_AMOUNT_MISMATCH/.test(backend)) fail.push('Paid webhooks must verify amount and currency.');
}

if (exists('firestore.rules')) {
  const rules = read('firestore.rules');
  if (!/email_verified\s*==\s*true/.test(rules)) fail.push('Owner/admin privileges must require a verified Firebase email.');
  if (!/function\s+verifiedEmail\s*\(/.test(rules) || !/function\s+owner[\s\S]{0,160}verifiedEmail\(\)/.test(rules)) fail.push('Owner authorization must be built on verifiedEmail().');
  if (!/function\s+isAdmin[\s\S]{0,220}verifiedEmail\(\)/.test(rules)) fail.push('Regular admin authorization must require verifiedEmail().');
  if (!/hasAny\(\['admins','payments','security'\]\)/.test(rules)) fail.push('Sensitive site config must remain owner-only.');
  if (!/match \/pricing\/\{id\}/.test(rules) || !/pricing[\s\S]{0,180}owner\(\)/.test(rules)) fail.push('Structured pricing collection must be owner-protected.');
  if (!/match \/auditLogs\/\{id\}/.test(rules) || !/allow update, delete: if false/.test(rules)) fail.push('Audit logs must remain append-only.');
}

if (exists('storage.rules')) {
  const rules = read('storage.rules');
  if (!/email_verified\s*==\s*true/.test(rules)) fail.push('Firebase Storage writes must require a verified owner email.');
  if (!/request\.resource\.size\s*<\s*10\s*\*\s*1024\s*\*\s*1024/.test(rules)) fail.push('Firebase Storage upload size limit is missing.');
}

if (exists('firebase-config.js')) {
  const boot = read('firebase-config.js');
  if (!/admin-auth-hardening\.js/.test(boot)) fail.push('Admin bootstrap must load verified-email hardening.');
  if (!/admin-payments\.js/.test(boot) || !/admin-pricing\.js/.test(boot) || !/admin-audit\.js/.test(boot) || !/admin-security\.js/.test(boot)) {
    fail.push('Admin commerce/security extensions are not fully wired.');
  }
}

[
  'commerce-core.js','app-check.js','firestore.rules','storage.rules','firebase.json','newlynow-theme.css',
  'newlynow-home-theme.css','newlynow-inner-theme.css','newlynow-commerce.css',
  'admin-auth-hardening.js','admin-payments.js','admin-pricing.js','admin-audit.js','admin-security.js',
  'functions/index.js','functions/payment-adapters.js','functions/pricing.js'
].forEach(f => { if (!exists(f)) fail.push(`Required NewlyNow file missing: ${f}`); });

for (const f of ['index.html','category.html','service.html','account.html','admin.html']) {
  if (exists(f) && /Elwaset|Elawaady XDigital|\bEXD\b/i.test(read(f))) warn.push(`Legacy source branding still present in ${f}`);
}

if (warn.length) {
  console.log('\nWarnings:');
  warn.forEach(x => console.log(' -', x));
}
if (fail.length) {
  console.error('\nValidation failed:');
  fail.forEach(x => console.error(' -', x));
  process.exit(1);
}
console.log(`\nNewlyNow validation passed (${files.length} files checked).`);
