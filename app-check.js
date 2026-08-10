// NewlyNow — App Check token provider for protected custom backend requests
(function () {
  'use strict';
  let initPromise = null;

  async function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      const cfg = window.FIREBASE_CONFIG;
      const security = window.NEWLYNOW_SECURITY_CONFIG || {};
      const siteKey = String(security.appCheckSiteKey || '').trim();
      if (!cfg || !cfg.apiKey || !siteKey) return null;

      const [appMod, checkMod] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-check.js')
      ]);
      const existing = appMod.getApps().find(a => a.name === 'newlynowAppCheckClient');
      const app = existing || appMod.initializeApp(cfg, 'newlynowAppCheckClient');
      const appCheck = checkMod.initializeAppCheck(app, {
        provider: new checkMod.ReCaptchaEnterpriseProvider(siteKey),
        isTokenAutoRefreshEnabled: true
      });
      return { appCheck, checkMod };
    })().catch(err => {
      console.warn('NewlyNow App Check unavailable', err);
      return null;
    });
    return initPromise;
  }

  window.NewlyNowAppCheck = {
    configured() {
      return !!String((window.NEWLYNOW_SECURITY_CONFIG || {}).appCheckSiteKey || '').trim();
    },
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
