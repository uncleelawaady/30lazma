import fs from 'node:fs';

const must = [
  'newlynow-theme.css','newlynow-burgundy-overrides.css','newlynow-font.css',
  'newlynow-home-theme.css','newlynow-inner-theme.css','newlynow-account-theme.css',
  'newlynow-admin-theme.css','newlynow-interactions.js','newlynow-layout.js',
  'newlynow-payments-display.js','newlynow-link-safety.js','newlynow-inner-polish.js','firebase-config.js','vercel.json'
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
}
if(fs.existsSync('newlynow-interactions.js')){
  const js=read('newlynow-interactions.js');
  if(!/__NEWLYNOW_INTERACTIONS_LOADED__/.test(js)) fail.push('Interactions duplicate-load guard missing.');
  if(!/pointermove/.test(js)||!/IntersectionObserver/.test(js)) fail.push('Expected lightweight interaction primitives missing.');
}
if(fs.existsSync('newlynow-link-safety.js')){
  const links=read('newlynow-link-safety.js');
  if(!/__NEWLYNOW_LINK_SAFETY__/.test(links)||!/noopener/.test(links)||!/noreferrer/.test(links)) fail.push('Dynamic link safety guard is incomplete.');
}
if(fs.existsSync('firebase-config.js')){
  const boot=read('firebase-config.js');
  if(!/newlynow-font\.css/.test(boot)) fail.push('Font layer is not bootstrapped.');
  if(!/newlynow-burgundy-overrides\.css/.test(boot)) fail.push('Burgundy override is not bootstrapped.');
  if(!/newlynow-payments-display\.js/.test(boot)) fail.push('Live payment display is not bootstrapped.');
  if(!/newlynow-link-safety\.js/.test(boot)) fail.push('Link safety guard is not bootstrapped.');
  if(!/newlynow-inner-polish\.js/.test(boot)) fail.push('Inner-page identity polish is not bootstrapped.');
}
if(fs.existsSync('vercel.json')){
  let v;
  try{v=JSON.parse(read('vercel.json'));}catch(_){fail.push('vercel.json must be valid JSON.');}
  if(v){
    const text=JSON.stringify(v);
    for(const h of ['X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Permissions-Policy','Strict-Transport-Security']){
      if(!text.includes(h)) fail.push(`Deployment security header missing: ${h}`);
    }
    if(!text.includes('no-store')) fail.push('Admin no-store cache policy is missing.');
  }
}
if(fail.length){console.error('\nTheme validation failed:');fail.forEach(x=>console.error(' -',x));process.exit(1);}
console.log('NewlyNow theme validation passed.');
