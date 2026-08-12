import fs from 'node:fs';
import test, { after, before } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';

let env;
const OWNER='elawaady.official@gmail.com';

before(async()=>{
  env=await initializeTestEnvironment({
    projectId:'demo-newlynow-storage',
    storage:{rules:fs.readFileSync('storage.rules','utf8')}
  });
});
after(async()=>{if(env)await env.cleanup();});

function storage(uid,email,verified=true){
  return env.authenticatedContext(uid,{email,email_verified:verified}).storage();
}

const smallImage=()=>new Uint8Array([137,80,78,71,13,10,26,10]);

test('verified owner can upload and delete allowed media',async()=>{
  const s=storage('owner',OWNER,true);
  const r=ref(s,'tests/owner-image.png');
  await assertSucceeds(uploadBytes(r,smallImage(),{contentType:'image/png'}));
  await assertSucceeds(deleteObject(r));
});

test('unverified owner email cannot upload',async()=>{
  const s=storage('owner-unverified',OWNER,false);
  await assertFails(uploadBytes(ref(s,'tests/unverified.png'),smallImage(),{contentType:'image/png'}));
});

test('non-owner cannot upload',async()=>{
  const s=storage('user','user@example.com',true);
  await assertFails(uploadBytes(ref(s,'tests/user.png'),smallImage(),{contentType:'image/png'}));
});

test('verified owner cannot upload executable, SVG, or arbitrary content types',async()=>{
  const s=storage('owner',OWNER,true);
  await assertFails(uploadBytes(ref(s,'tests/file.html'),new TextEncoder().encode('<script>alert(1)</script>'),{contentType:'text/html'}));
  await assertFails(uploadBytes(ref(s,'tests/file.svg'),new TextEncoder().encode('<svg onload="alert(1)"></svg>'),{contentType:'image/svg+xml'}));
  await assertFails(uploadBytes(ref(s,'tests/file.bin'),new Uint8Array([1,2,3]),{contentType:'application/octet-stream'}));
});

test('public can read an allowed object but cannot delete it',async()=>{
  const owner=storage('owner',OWNER,true);
  const r=ref(owner,'tests/public.png');
  await assertSucceeds(uploadBytes(r,smallImage(),{contentType:'image/png'}));
  const guest=env.unauthenticatedContext().storage();
  await assertSucceeds(getBytes(ref(guest,'tests/public.png')));
  await assertFails(deleteObject(ref(guest,'tests/public.png')));
  await assertSucceeds(deleteObject(r));
});
