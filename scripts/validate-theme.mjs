import fs from 'node:fs';

const must = [
  'newlynow-theme.css','newlynow-burgundy-overrides.css','newlynow-font.css','newlynow-contact-theme.css',
  'newlynow-home-theme.css','newlynow-inner-theme.css','newlynow-account-theme.css',
  'newlynow-admin-theme.css','newlynow-interactions.js','newlynow-layout.js',
  'newlynow-payments-display.js','newlynow-link-safety.js','newlynow-inner-polish.js',
  'firebase-config.js','script.js','contact.js','robots.txt','sitemap.xml','manifest.webmanifest','vercel.json'
];
const fail=[];
for(const f of must) if(!fs.existsSync(f)) fail.push(`Missing theme asset: ${f}`);
const read=f=>fs.readFileSync(f,'utf8');
if(fs.existsSync('newlynow-burgundy-overrides.css')){
  const css=read('newlynow-burgundy-overrides.css');
  for(const token of ['#070104','#16020A','#4A0B24','#F20F62','#FF2F7D','#FF8DB7','#FFF8FB','#BEA7B2']){
    if(!css.includes(token)) fail.push(`Theme token missing: ${token}`);
  }
  if(!/prefers-reduced-motion/.test(css)) fail.push('Reduced-motion protection missing from theme.');
  if(!/nn-search-empty/.test(css)) fail.push('Search empty-state styling is missing.');
}
if(fs.existsSync('newlynow-interactions.js')){
  const js=read('newlynow-interactions.js');
  if(!/__NEWLYNOW_INTERACTIONS_LOADED__/.test(js)) fail.push('Interactions duplicate-load guard missing.');
  if(!/pointermove/.test(js)||!/IntersectionObserver/.test(js)) fail.push('Expected lightweight interaction primitives missing.');
}
if(fs.existsSync('script.js')){
  const js=read('script.js');
  if(!/__NEWLYNOW_CORE_SCRIPT__/.test(js)) fail.push('Core storefront duplicate-load guard missing.');
  if(!/nn-search-empty/.test(js)||!/اطلب البحث عن الخدمة/.test(js)) fail.push('Professional no-results search flow missing.');
  if(/window\.open\([^\n]*wa\.me/.test(js)) fail.push('Search must not auto-open WhatsApp when no result is found.');
}
if(fs.existsSync('contact.js')){
  const js=read('contact.js');
  if(!/__NEWLYNOW_CONTACT__/.test(js)||!/NewlyNowContact/.test(js)) fail.push('NewlyNow contact runtime is incomplete.');
}
if(fs.existsSync('newlynow-link-safety.js')){
  const links=read('newlynow-link-safety.js');
  if(!/__NEWLYNOW_LINK_SAFETY__/.test(links)||!/noopener/.test(links)||!/noreferrer/.test(links)) fail.push('Dynamic link safety guard is incomplete.');
}
if(fs.existsSync('firebase-config.js')){
  const boot=read('firebase-config.js');
  for(const asset of ['newlynow-font.css','newlynow-contact-theme.css','newlynow-burgundy-overrides.css','newlynow-payments-display.js','newlynow-link-safety.js','newlynow-inner-polish.js']){
    if(!boot.includes(asset)) fail.push(`Bootstrap asset missing: ${asset}`);
  }
  if(!/manifest\.webmanifest/.test(boot)||!/theme-color/.test(boot)) fail.push('Manifest/browser theme bootstrap is missing.');
}
if(fs.existsSync('manifest.webmanifest')){
  let manifest;
  try{manifest=JSON.parse(read('manifest.webmanifest'));}catch(_){fail.push('manifest.webmanifest must be valid JSON.');}
  if(manifest && (manifest.name!=='NewlyNow'||manifest.theme_color!=='#F20F62'||manifest.dir!=='rtl')) fail.push('Manifest branding/theme is inconsistent.');
}
if(fs.existsSync('robots.txt')&&!/Disallow:\s*\/admin/.test(read('robots.txt'))) fail.push('Admin robots exclusion is missing.');
if(fs.existsSync('sitemap.xml')&&!/https:\/\/newlynow\.com\//.test(read('sitemap.xml'))) fail.push('Sitemap does not target NewlyNow.com.');
if(fs.existsSync('vercel.json')){
  let v;
  try{v=JSON.parse(read('vercel.json'));}catch(_){fail.push('vercel.json must be valid JSON.');}
  if(v){
    const text=JSON.stringify(v);
    for(const h of ['X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Permissions-Policy','Strict-Transport-Security']){
      if(!text.includes(h)) fail.push(`Deployment security header missing: ${h}`);
    }
    if(!text.includes('no-store')) fail.push('Admin no-store cache policy is missing.');
    if(!text.includes('must-revalidate')) fail.push('Bootstrap cache revalidation is missing.');
  }
}
if(fail.length){console.error('\nTheme validation failed:');fail.forEach(x=>console.error(' -',x));process.exit(1);}
console.log('NewlyNow theme validation passed.');
