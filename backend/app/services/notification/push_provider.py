"""
Push Notification Provider Abstraction.
Supports Expo Push Service (for React Native/Expo mobile apps) and Web Push (VAPID).
Safely handles network errors, token validation, and inactive token cleanup.
"""

import json
import logging
import os
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

logger = logging.getLogger('push_provider')


class BasePushProvider(ABC):
    @abstractmethod
    def send(self, token: str, title: str, body: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Send a single push notification."""
        pass

    @abstractmethod
    def send_bulk(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Send a batch of push notifications."""
        pass


class ExpoPushProvider(BasePushProvider):
    """
    Expo Push Notification Provider using exponent_server_sdk.
    Handles batching, ticket receipts, and auto-deactivation of stale device tokens.
    """

    def __init__(self):
        self.access_token = os.environ.get('EXPO_ACCESS_TOKEN', '').strip() or None
        self._client = None
        self._sdk_available = False

        try:
            from exponent_server_sdk import PushClient
            self._client = PushClient(access_token=self.access_token) if self.access_token else PushClient()
            self._sdk_available = True
            logger.info("ExpoPushProvider initialized successfully.")
        except Exception as e:
            logger.warning(f"ExpoPushProvider SDK init note: {e}")

    def is_valid_token(self, token: str) -> bool:
        if not token or not isinstance(token, str):
            return False
        if not self._sdk_available:
            return token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken[")
        try:
            from exponent_server_sdk import PushClient
            return PushClient.is_exponent_push_token(token)
        except Exception:
            return token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken[")

    def send(self, token: str, title: str, body: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        results = self.send_bulk([{
            'token': token,
            'title': title,
            'body': body,
            'data': data or {}
        }])
        return results[0] if results else {'status': 'FAILED', 'error': 'No response'}

    def send_bulk(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        items: list of dicts with keys: token, title, body, data (optional), sound (optional)
        Returns list of result dicts: {token, status: 'SENT'|'FAILED'|'DEVICE_NOT_REGISTERED', ticket_id, error}
        """
        if not items:
            return []

        results = []
        valid_messages = []
        token_to_idx = {}

        for idx, item in enumerate(items):
            token = item.get('token', '').strip()
            title = item.get('title', '')
            body = item.get('body', '')
            data = item.get('data') or {}
            sound = item.get('sound', 'default')

            if not self.is_valid_token(token):
                results.append({
                    'token': token,
                    'status': 'INVALID_TOKEN',
                    'error': 'Token does not match Expo push token pattern'
                })
                continue

            try:
                from exponent_server_sdk import PushMessage
                msg = PushMessage(
                    to=token,
                    title=title,
                    body=body,
                    data=data,
                    sound=sound,
                    badge=1
                )
                valid_messages.append(msg)
                token_to_idx[token] = len(results)
                results.append({
                    'token': token,
                    'status': 'PENDING',
                    'error': None
                })
            except Exception as ex:
                results.append({
                    'token': token,
                    'status': 'FAILED',
                    'error': str(ex)
                })

        if not valid_messages or not self._sdk_available or not self._client:
            if not self._sdk_available:
                logger.warning("Expo Push SDK not initialized; push dispatch simulated/skipped.")
            return results

        # Expo batch limit is 100 messages per request
        batch_size = 100
        for i in range(0, len(valid_messages), batch_size):
            chunk = valid_messages[i:i + batch_size]
            try:
                responses = self._client.publish_multiple(chunk)
                for response, msg in zip(responses, chunk):
                    res_idx = token_to_idx.get(msg.to)
                    if res_idx is None:
                        continue

                    try:
                        response.validate_response()
                        results[res_idx]['status'] = 'SENT'
                        results[res_idx]['ticket_id'] = getattr(response, 'id', None)
                    except Exception as exc:
                        error_data = getattr(exc, 'extra_data', {}) or {}
                        details = error_data.get('details', {})
                        err_code = details.get('error')

                        if err_code == 'DeviceNotRegistered':
                            results[res_idx]['status'] = 'DEVICE_NOT_REGISTERED'
                            results[res_idx]['error'] = 'Device token has expired or is no longer registered'
                            self._deactivate_token(msg.to)
                        else:
                            results[res_idx]['status'] = 'FAILED'
                            results[res_idx]['error'] = f"{str(exc)} (code: {err_code})"
            except Exception as batch_err:
                logger.error(f"Expo batch push dispatch error: {batch_err}")
                for msg in chunk:
                    res_idx = token_to_idx.get(msg.to)
                    if res_idx is not None and results[res_idx]['status'] == 'PENDING':
                        results[res_idx]['status'] = 'FAILED'
                        results[res_idx]['error'] = str(batch_err)

        return results

    def _deactivate_token(self, token: str):
        """Auto-deactivate stale device tokens in DB so we stop pushing to dead devices."""
        try:
            from app import db
            from app.models.device import UserDevice
            devices = UserDevice.query.filter(
                (UserDevice.device_token == token) | (UserDevice.expo_push_token == token)
            ).all()
            for d in devices:
                d.is_active = False
            if devices:
                db.session.commit()
                logger.info(f"Deactivated {len(devices)} device(s) for dead token {token[:20]}...")
        except Exception as e:
            logger.warning(f"Error deactivating dead token {token[:20]}: {e}")


class WebPushProvider(BasePushProvider):
    """
    Web Push Provider using VAPID and pywebpush.
    Sends standard browser Web Push Notifications.
    """

    def __init__(self):
        self.vapid_private_key = os.environ.get('WEB_PUSH_VAPID_PRIVATE_KEY', '').strip()
        self.vapid_public_key = os.environ.get('WEB_PUSH_VAPID_PUBLIC_KEY', '').strip()
        self.vapid_email = os.environ.get('WEB_PUSH_VAPID_EMAIL', 'mailto:admin@eduerp.internal').strip()

    def send(self, token: str, title: str, body: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        token for web push is expected to be a JSON string of Web Push Subscription
        e.g. {"endpoint": "...", "keys": {"p256dh": "...", "auth": "..."}}
        """
        if not self.vapid_private_key:
            return {'status': 'SKIPPED', 'error': 'VAPID keys not configured in environment'}

        try:
            import json
            from pywebpush import webpush, WebPushException

            sub_info = json.loads(token) if isinstance(token, str) and token.strip().startswith('{') else None
            if not sub_info or 'endpoint' not in sub_info:
                return {'status': 'INVALID_TOKEN', 'error': 'Invalid Web Push subscription JSON'}

            payload = json.dumps({
                'title': title,
                'body': body,
                'icon': '/favicon.ico',
                'badge': '/favicon.ico',
                'data': data or {},
            })

            vapid_claims = {
                'sub': self.vapid_email if self.vapid_email.startswith('mailto:') else f"mailto:{self.vapid_email}"
            }

            webpush(
                subscription_info=sub_info,
                data=payload,
                vapid_private_key=self.vapid_private_key,
                vapid_claims=vapid_claims
            )
            return {'status': 'SENT', 'error': None}
        except Exception as ex:
            logger.warning(f"Web Push dispatch failed: {ex}")
            return {'status': 'FAILED', 'error': str(ex)}

    def send_bulk(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return [self.send(item.get('token'), item.get('title'), item.get('body'), item.get('data')) for item in items]


class PushDispatcher:
    """
    Unified Push Dispatcher that delegates to ExpoPushProvider for mobile tokens
    and WebPushProvider for web/pwa subscription tokens.
    """

    def __init__(self):
        self.expo = ExpoPushProvider()
        self.web = WebPushProvider()

    def dispatch_for_devices(self, devices: List[Any], title: str, body: str, data: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        devices: list of UserDevice instances.
        Determines appropriate provider by platform and token format.
        """
        expo_items = []
        web_items = []
        results = []

        for d in devices:
            if not d.is_active:
                continue

            push_token = d.expo_push_token or d.device_token
            if not push_token:
                continue

            if d.platform in ('android', 'ios') or self.expo.is_valid_token(push_token):
                expo_items.append({
                    'device_id': d.id,
                    'user_id': d.user_id,
                    'token': push_token,
                    'title': title,
                    'body': body,
                    'data': data or {}
                })
            else:
                web_items.append({
                    'device_id': d.id,
                    'user_id': d.user_id,
                    'token': push_token,
                    'title': title,
                    'body': body,
                    'data': data or {}
                })

        if expo_items:
            expo_results = self.expo.send_bulk(expo_items)
            for item, res in zip(expo_items, expo_results):
                res['user_id'] = item['user_id']
                res['channel'] = 'expo_push'
                results.append(res)

        if web_items:
            web_results = self.web.send_bulk(web_items)
            for item, res in zip(web_items, web_results):
                res['user_id'] = item['user_id']
                res['channel'] = 'web_push'
                results.append(res)

        return results


# Global singleton instance
push_dispatcher = PushDispatcher()
