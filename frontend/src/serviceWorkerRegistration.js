/**
 * OP360 EduERP — Service Worker Registration
 *
 * Standard CRA registration pattern (register/unregister + localhost
 * validity check), extended with:
 *   - onUpdate(registration): fired when a NEW service worker is waiting
 *     to activate (i.e. a new version was deployed). The app uses this
 *     to show the "New version available" toast.
 *   - onSuccess(registration): fired the first time content is precached
 *     for offline use.
 *   - applyUpdate(registration): call this from the "Update Now" button.
 *     Posts SKIP_WAITING to the waiting worker, then reloads once the
 *     new worker takes control — done exactly once via a guard flag so
 *     a flaky double-fire of controllerchange can't reload twice.
 */

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}$/)
);

export function register(config) {
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
    return;
  }

  const publicUrl = new URL(process.env.PUBLIC_URL, window.location.href);
  if (publicUrl.origin !== window.location.origin) {
    // Service worker can't function if PUBLIC_URL is on a different origin
    // (e.g. a CDN) from where the page is served.
    return;
  }

  window.addEventListener('load', () => {
    const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

    if (isLocalhost) {
      checkValidServiceWorker(swUrl, config);
      navigator.serviceWorker.ready.then(() => {
        // Running on localhost — helpful during development only.
      });
    } else {
      registerValidSW(swUrl, config);
    }
  });
}

function registerValidSW(swUrl, config) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) return;

        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // New content is cached and a previous SW controlled the
              // page before -> an update is ready and waiting.
              if (config && config.onUpdate) {
                config.onUpdate(registration);
              }
            } else {
              // First install — everything is precached for offline use.
              if (config && config.onSuccess) {
                config.onSuccess(registration);
              }
            }
          }
        };
      };
    })
    .catch(() => {
      // Registration failed — app still works online, just without PWA caching.
    });
}

function checkValidServiceWorker(swUrl, config) {
  fetch(swUrl, { headers: { 'Service-Worker': 'script' } })
    .then((response) => {
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => window.location.reload());
        });
      } else {
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      // No connectivity — app runs in offline mode until network returns.
    });
}

/**
 * Activates a waiting service worker and reloads the page once it takes
 * control. Call from the "Update Now" toast action.
 */
export function applyUpdate(registration) {
  const waitingWorker = registration && registration.waiting;
  if (!waitingWorker) return;

  let hasReloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hasReloaded) return;
    hasReloaded = true;
    window.location.reload();
  });

  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => registration.unregister())
      .catch(() => {});
  }
}
