# نشر البورتفوليو على دومين elawaady.com في هوستنجر

الموقع كله **HTML/CSS/JS ثابت** — مفيش قواعد بيانات ولا PHP ولا build. يعني بترفع الملفات وخلاص.

---

## الملفات اللي بترفعها

من مجلد `portfolio/` ارفع دول **بمحتوياتهم مباشرة** (مش المجلد نفسه):

```
index.html
style.css
script.js
robots.txt
sitemap.xml
.htaccess          ← مهم (HTTPS + إعادة التوجيه + الكاش)
assets/            ← الصور
```

---

## الطريقة 1: File Manager من hPanel (الأسهل)

1. ادخل [hpanel.hostinger.com](https://hpanel.hostinger.com) بحساب `elawaady.com`.
2. **Websites** → اختار `elawaady.com` → **Dashboard**.
3. **Files** → **File Manager**.
4. افتح مجلد `public_html`.
5. لو فيه ملف `default.php` أو `index.html` افتراضي من هوستنجر — امسحه.
6. اضغط **Upload Files** وارفع كل الملفات فوق.
   - أسهل حاجة: اعمل ZIP لمحتويات `portfolio/` وارفع الـ ZIP، وبعدين **Extract** جوه `public_html`.
   - ملف `.htaccess` مخفي — لو مش ظاهر، فعّل **Settings → Show hidden files**.
7. افتح `https://elawaady.com` — المفروض تلاقي الموقع شغال.

> **مهم:** لازم `index.html` يكون في جذر `public_html` مباشرة، مش جوه مجلد `portfolio`.

---

## الطريقة 2: Git deployment من hPanel (أنضف للتحديثات)

هوستنجر بتسحب الريبو بالكامل، فلازم يبقى `index.html` في جذر الريبو — والريبو الحالي جذره متجر Elwaset. عندك حلين:

- **حل أ (مستحسن):** اعمل ريبو جديد مخصص للبورتفوليو (مثلاً `elawaady-portfolio`) وحُط فيه محتويات `portfolio/` في الجذر، وبعدين وصّله بهوستنجر.
- **حل ب:** اربط الريبو ده وبعدين في File Manager انقل محتويات `portfolio/` لـ `public_html`.

خطوات الربط:

1. hPanel → **Advanced** → **GIT**.
2. **Repository URL:** رابط الريبو (لو خاص، ضيف SSH key اللي هوستنجر بتعطيه لك في GitHub → Settings → Deploy keys).
3. **Branch:** `main` (أو الفرع اللي فيه شغلك).
4. **Directory:** سيبها فاضية = `public_html`.
5. **Create** → وبعد كده كل مرة تعمل push اضغط **Deploy** (أو استخدم Auto-Deployment webhook).

---

## الطريقة 3: FTP (لو بتفضل FileZilla)

hPanel → **Files** → **FTP Accounts** = هتلاقي:

| البيانات | القيمة |
|---|---|
| Host | `ftp.elawaady.com` (أو الـ IP الظاهر في الصفحة) |
| Port | 21 |
| Username / Password | من نفس الصفحة |

اتصل، ادخل `public_html`، وارفع الملفات.

---

## SSL وتفعيل HTTPS

1. hPanel → **Security** → **SSL** → لو مفعّلش اضغط **Install SSL** (مجاني — Let's Encrypt).
2. فعّل **Force HTTPS** — وملف `.htaccess` كمان بيعمل التحويل ده تلقائيًا.
3. استنى 15–60 دقيقة لحد ما الشهادة تشتغل.

---

## الدومين والـ DNS

- **لو الدومين مسجّل في هوستنجر ونفس الحساب:** مش محتاج تعمل أي حاجة، الربط تلقائي.
- **لو الدومين مسجّل في مكان تاني:** غيّر الـ nameservers عند المسجّل لـ:
  ```
  ns1.dns-parking.com
  ns2.dns-parking.com
  ```
  والانتشار بياخد من ساعة لـ 24 ساعة.
- **لو عايز الموقع يشتغل على `www` كمان:** hPanel → **Domains** → اتأكد إن `www.elawaady.com` معمولها A record أو CNAME على نفس الاستضافة. ملف `.htaccess` بيحوّل `www` للنسخة بدون `www`.

---

## بعد النشر — تشيك ليست

- [ ] `https://elawaady.com` يفتح ويعرض الموقع
- [ ] القفل الأخضر (SSL) ظاهر
- [ ] `http://elawaady.com` بيحوّل تلقائي على `https`
- [ ] زرار **EN** بيقلب الموقع للإنجليزي والاتجاه لـ LTR
- [ ] فورم التواصل بيفتح واتساب برسالة جاهزة
- [ ] الموقع مظبوط على الموبايل
- [ ] الصور في `assets/` كلها ظاهرة

---

## تعديل المحتوى بعد كده

كل النصوص والخدمات والمشاريع والمهارات موجودين في مكان واحد: **أول 120 سطر في `script.js`** جوه الـ `DATA` object. كل عنصر له نسخة عربي (`ar`) ونسخة إنجليزي (`en`):

```js
services: [
  { icon:'fa-solid fa-handshake',
    ar:['وساطة آمنة','الوصف بالعربي...'],
    en:['Secure escrow','Description in English...'] },
]
```

- **رقم الواتساب:** ثابت `WHATSAPP` في أول `script.js`.
- **الإيميل واللينكات:** في `index.html` قسم `#contact` والـ footer.
- **الألوان:** متغيرات CSS في أول `style.css` (`--primary` / `--secondary` / `--accent`).
- **صورتك:** استبدل `assets/ahmed-cutout.png` بنفس الاسم.
- **الأرقام في الهيرو:** خصائص `data-count` في `index.html`.

> بعد أي تعديل على `style.css` أو `script.js`، غيّر رقم النسخة في `index.html` (`style.css?v=2`, `script.js?v=2`) عشان تكسر كاش المتصفح عند الزوار.

---

## ملاحظة أمنية مهمة

ملف `.claude/settings.json` في الريبو ده فيه **Hostinger API token مكتوب صريح**. أي حد يشوف الريبو يقدر يستخدمه على حسابك. المفروض:

1. تدخل hPanel → **API** وتعمل **Revoke** للتوكن الحالي.
2. تعمل توكن جديد وتحطه في متغير بيئة على جهازك (مش في ملف داخل الريبو).
3. تشيل التوكن من تاريخ الجيت كمان (التوكن القديم يفضل موجود في الـ commits القديمة حتى لو مسحته من الملف).
