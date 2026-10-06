import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import notificationService from '../services/notificationService';
import { useAuth } from './AuthContext';

// Configure default notification handler for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const NotificationContext = createContext(null);

export function NotificationProvider({ children, navigationRef }) {
  const { user } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notification, setNotification] = useState(null);

  const notificationListener = useRef();
  const responseListener = useRef();

  // 1. Fetch unread count badge
  const refreshUnreadCount = useCallback(async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch (err) {
      // silently ignore
    }
  }, []);

  // 2. Register for Expo Push Notifications
  const registerForPushNotificationsAsync = useCallback(async () => {
    let token = null;

    try {
      // Create Android Notification Channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'General Notifications',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0176d3',
          sound: 'default',
        });
      }

      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request if not already granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[NotificationContext] Push notification permission not granted');
        return null;
      }

      // Obtain Expo push token
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ||
        Constants?.easConfig?.projectId ||
        '364fb3b9-034c-439d-8c05-7462d31e5171';

      const tokenRes = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });
      token = tokenRes.data;
      setExpoPushToken(token);

      // Register device token with backend
      if (token) {
        await notificationService.registerDeviceToken({
          expo_push_token: token,
          device_token: token,
          platform: Platform.OS,
          device_name: `${Platform.OS.toUpperCase()} Mobile Device`,
          app_version: Constants?.expoConfig?.version || '1.0.0',
        });
        console.log('[NotificationContext] Push token registered with backend:', token);
      }
    } catch (error) {
      console.warn('[NotificationContext] Error registering push notifications:', error?.message);
    }

    return token;
  }, []);

  // Re-register token and reload unread count when user changes
  useEffect(() => {
    if (user?.id) {
      registerForPushNotificationsAsync();
      refreshUnreadCount();
    } else {
      setUnreadCount(0);
    }
  }, [user?.id, registerForPushNotificationsAsync, refreshUnreadCount]);

  useEffect(() => {
    // Initial fetch on mount
    refreshUnreadCount();

    // Listen for incoming notifications while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener((notif) => {
      setNotification(notif);
      setUnreadCount((prev) => prev + 1);
    });

    // Listen for user tapping on notification (lock screen or tray)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data;
      if (data && navigationRef?.current) {
        const deepLink = data.deep_link;
        const category = data.category;

        if (deepLink) {
          if (deepLink.includes('fee')) navigationRef.current.navigate('Fees');
          else if (deepLink.includes('attendance')) navigationRef.current.navigate('Attendance');
          else if (deepLink.includes('exam')) navigationRef.current.navigate('Exams');
          else if (deepLink.includes('result')) navigationRef.current.navigate('Results');
          else if (deepLink.includes('hostel')) navigationRef.current.navigate('Hostel');
          else if (deepLink.includes('transport')) navigationRef.current.navigate('Transport');
          else navigationRef.current.navigate('Notifications');
        } else if (category === 'FEES') {
          navigationRef.current.navigate('Fees');
        } else if (category === 'ATTENDANCE') {
          navigationRef.current.navigate('Attendance');
        } else {
          navigationRef.current.navigate('Notifications');
        }
      }
    });

    // Periodic poll for unread count
    const interval = setInterval(() => {
      refreshUnreadCount();
    }, 45000);

    return () => {
      clearInterval(interval);
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [registerForPushNotificationsAsync, refreshUnreadCount, navigationRef]);

  // Mark single as read
  const markAsRead = async (id) => {
    await notificationService.markAsRead(id);
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  // Mark all as read
  const markAllAsRead = async () => {
    await notificationService.markAllAsRead();
    setUnreadCount(0);
  };

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        unreadCount,
        notification,
        refreshUnreadCount,
        markAsRead,
        markAllAsRead,
        registerPushToken: registerForPushNotificationsAsync,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useMobileNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    return {
      unreadCount: 0,
      refreshUnreadCount: () => {},
      markAsRead: () => {},
      markAllAsRead: () => {},
    };
  }
  return context;
}

export default NotificationContext;
