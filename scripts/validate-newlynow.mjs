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

// 1) Syntax-check project JavaScript (browser modules included).
for (const file of files.filter(f => /\.m?js$/i.test(f))) {
  try { execFileSync(process.execPath, ['--check', file], { cwd: root, stdio:'pipe' }); }
  catch (e) { fail.push(`JavaScript syntax error: ${file}\n${String(e.stderr || e.message)}`); }
}

// 2) Verify local CSS/JS references used by HTML actually exist.
for (const file of files.filter(f => /\.html$/i.test(f))) {
  const html = read(file);
  const refs = [...html.matchAll(/(?:src|href)=["']([^"'#?]+)(?:\?[^"']*)?["']/gi)].map(m => m[1]);
  for (const ref of refs) {
    if (/^(?:https?:|data:|mailto:|tel:|\/\/)/i.test(ref)) continue;
    const local = path.posix.normalize(path.posix.join(path.posix.dirname(file), ref));
    if (/\.(?:js|css)$/i.test(local) && !exists(local)) fail.push(`${file} references missing local asset: ${local}`);
  }
}

// 3) Block common private-secret files and high-risk secret assignments.
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

// 4) Commerce invariants: only admin/server code may assign a paid state.
for (const file of files.filter(f => /\.(?:js|html)$/i.test(f))) {
  const text = read(file);
  if (/admin-payments\.js$/.test(file)) continue;
  if (/paymentStatus\s*[:=]\s*["']paid["']/i.test(text) || /status\s*[:=]\s*["']paid["']/i.test(text)) {
    fail.push(`Client-side paid-state assignment is forbidden: ${file}`);
  }
}

// 5) Required NewlyNow commerce/security files.
[
  'commerce-core.js','firestore.rules','storage.rules','newlynow-theme.css',
  'newlynow-home-theme.css','newlynow-inner-theme.css','newlynow-commerce.css'
].forEach(f => { if (!exists(f)) fail.push(`Required NewlyNow file missing: ${f}`); });

// Legacy branding remains tolerated only in old source until source-level migration is complete.
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
