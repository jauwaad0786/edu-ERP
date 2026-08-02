/**
 * OP360 EduERP — Notification Service (architecture only)
 *
 * Prepares the push-notification plumbing WITHOUT wiring a provider yet.
 * Firebase Cloud Messaging (or any other provider) is intentionally not
 * implemented here — every provider-specific step is marked with a TODO.
 *
 * Flow this is built for:
 *   1. requestPermission()   -> ask the user for Notification permission
 *   2. registerPush()        -> subscribe the active SW to push, send the
 *                                subscription to the backend
 *   3. unsubscribe()         -> tear down the subscription, both locally
 *                                and on the backend
 *
 * None of this activates anything by itself — the app must explicitly
 * call requestPermission()/registerPush() from a user-initiated action
 * (e.g. a "Enable notifications" button in settings), never on load.
 */

import api from '../api/axios';

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getPermissionState() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

/**
 * Asks the browser for notification permission. Must be called from a
 * user gesture (click handler) — browsers ignore/reject calls made on
 * page load.
 */
export async function requestPermission() {
  if (!isPushSupported()) {
    return 'unsupported';
  }
  const result = await Notification.requestPermission();
  return result; // 'granted' | 'denied' | 'default'
}

/**
 * Subscribes the current service worker registration to push and sends
 * the subscription to the backend so it can target this device later.
 *
 * TODO(push-provider): once a provider is chosen (Firebase Cloud
 * Messaging is the likely candidate given the existing WhatsApp/Meta
 * integration patterns in this codebase), fill in:
 *   - VAPID_PUBLIC_KEY below (from the provider's console)
 *   - the backend endpoint to persist subscriptions (e.g.
 *     POST /api/notifications/push-subscriptions)
 */
export async function registerPush() {
  if (!isPushSupported()) {
    return { success: false, reason: 'unsupported' };
  }

  const permission = getPermissionState();
  if (permission !== 'granted') {
    return { success: false, reason: 'permission-not-granted' };
  }

  // TODO(push-provider): replace with the real VAPID public key.
  const VAPID_PUBLIC_KEY = null;

  if (!VAPID_PUBLIC_KEY) {
    return { success: false, reason: 'provider-not-configured' };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    // TODO(push-provider): confirm the real endpoint/payload shape with
    // the backend team before enabling this call.
    await api.post('/notifications/push-subscriptions', {
      subscription: subscription.toJSON(),
    });

    return { success: true, subscription };
  } catch (error) {
    return { success: false, reason: 'subscribe-failed', error };
  }
}

/**
 * Removes the push subscription locally and tells the backend to stop
 * targeting this device.
 *
 * TODO(push-provider): confirm the real unsubscribe endpoint with the
 * backend team.
 */
export async function unsubscribe() {
  if (!isPushSupported()) {
    return { success: false, reason: 'unsupported' };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      return { success: true, reason: 'not-subscribed' };
    }

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();

    // TODO(push-provider): confirm the real endpoint/payload shape.
    await api.post('/notifications/push-subscriptions/remove', { endpoint });

    return { success: true };
  } catch (error) {
    return { success: false, reason: 'unsubscribe-failed', error };
  }
}

// Converts a base64 VAPID key (as providers hand it out) into the
// Uint8Array format the Push API requires.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
