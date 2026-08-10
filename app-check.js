// NewlyNow — App Check token provider for protected custom backend requests
(function () {
  'use strict';
  let initPromise = null;

  function siteKey() {
    const live = window.SITE_CONFIG && window.SITE_CONFIG.security;
    const local = window.NEWLYNOW_SECURITY_CONFIG || {};
    return String((live && live.appCheckSiteKey) || local.appCheckSiteKey || '').trim();
  }

  async function init() {
    const key = siteKey();
    const cfg = window.FIREBASE_CONFIG;
    if (!cfg || !cfg.apiKey || !key) return null;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      const [appMod, checkMod] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-check.js')
      ]);
      const existing = appMod.getApps().find(a => a.name === 'newlynowAppCheckClient');
      const app = existing || appMod.initializeApp(cfg, 'newlynowAppCheckClient');
      const appCheck = checkMod.initializeAppCheck(app, {
        provider: new checkMod.ReCaptchaEnterpriseProvider(key),
        isTokenAutoRefreshEnabled: true
      });
      return { appCheck, checkMod };
    })().catch(err => {
      initPromise = null;
      console.warn('NewlyNow App Check unavailable', err);
      return null;
    });
    return initPromise;
  }

  window.NewlyNowAppCheck = {
    configured() { return !!siteKey(); },
    async getToken(forceRefresh) {
      const ready = await init();
      if (!ready) return '';
      try {
        const result = await ready.checkMod.getToken(ready.appCheck, !!forceRefresh);
        return result && result.token || '';
      } catch (err) {
        console.warn('NewlyNow App Check token failed', err);
        return '';
      }
    }
  };
})();
