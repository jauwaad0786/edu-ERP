/**
 * OP360 EduERP — Background Sync (architecture only)
 *
 * Lets a failed mutation (e.g. marking attendance while offline) be
 * queued and automatically retried once connectivity returns, using the
 * Background Sync API where supported (Chrome/Edge/Android — no Safari
 * support, so this always degrades gracefully to "do nothing extra").
 *
 * Nothing here talks to the backend yet — the service-worker side of
 * this (listening for the 'sync' event and actually replaying queued
 * requests) is intentionally left as a TODO until specific offline-write
 * flows (e.g. attendance marking, fee receipt drafts) are prioritized.
 *
 * Intended flow once implemented:
 *   1. A mutation fails because the device is offline.
 *   2. queueRequest() stores { url, method, body, headers, queuedAt } in
 *      IndexedDB (TODO: pick a queue store — workbox-background-sync's
 *      Queue class is the natural fit given the rest of the SW already
 *      uses Workbox).
 *   3. registerSyncTag() asks the browser to fire a 'sync' event once
 *      back online.
 *   4. TODO(service-worker): add a `self.addEventListener('sync', ...)`
 *      handler in service-worker.js that drains the queue and replays
 *      each request via fetch().
 */

const SYNC_TAG = 'op360-offline-mutation-sync';

export function isBackgroundSyncSupported() {
  return (
    'serviceWorker' in navigator &&
    'SyncManager' in window
  );
}

/**
 * Registers a one-off sync request with the browser. Call this right
 * after queueRequest() so the browser knows to wake the service worker
 * once connectivity is back.
 */
export async function registerSyncTag(tag = SYNC_TAG) {
  if (!isBackgroundSyncSupported()) {
    return { success: false, reason: 'unsupported' };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register(tag);
    return { success: true };
  } catch (error) {
    return { success: false, reason: 'register-failed', error };
  }
}

/**
 * TODO(queue-store): implement the actual queue write. Placeholder
 * signature only, so calling code (e.g. a failed-attendance-save
 * handler) has a stable API to build against.
 *
 * Expected shape once implemented:
 *   queueRequest({ url, method, body, headers })
 *     -> writes to an IndexedDB-backed queue (workbox-background-sync's
 *        Queue, or a hand-rolled idb store)
 *     -> calls registerSyncTag()
 */
export async function queueRequest(/* { url, method, body, headers } */) {
  // TODO(queue-store): not implemented yet — no offline-write flow
  // depends on this until a queue store is chosen.
  return { success: false, reason: 'not-implemented' };
}

export const BACKGROUND_SYNC_TAG = SYNC_TAG;
