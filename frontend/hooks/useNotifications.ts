import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

export function useNotifications() {
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const [notification, setNotification] = useState<Notifications.Notification | null>(null);
    const notificationListener = useRef<Notifications.Subscription>();
    const responseListener = useRef<Notifications.Subscription>();
    const { isAuthenticated } = useAuthStore();

    useEffect(() => {
        if (!isAuthenticated) return;

        registerForPushNotifications().then(token => {
            if (token) {
                setExpoPushToken(token);
                // Register token with backend
                api.registerPushToken(token, Platform.OS as 'ios' | 'android').catch(console.error);
            }
        });

        // Listen for incoming notifications
        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            setNotification(notification);
        });

        // Listen for notification responses (user tapped on notification)
        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data;
            handleNotificationResponse(data);
        });

        return () => {
            if (notificationListener.current) {
                Notifications.removeNotificationSubscription(notificationListener.current);
            }
            if (responseListener.current) {
                Notifications.removeNotificationSubscription(responseListener.current);
            }
        };
    }, [isAuthenticated]);

    return { expoPushToken, notification };
}

async function registerForPushNotifications(): Promise<string | null> {
    let token: string | null = null;

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Push notification permission not granted');
            return null;
        }

        token = (await Notifications.getExpoPushTokenAsync()).data;
    } else {
        console.log('Push notifications require a physical device');
    }

    // Android requires notification channel
    if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#4285F4',
        });
    }

    return token;
}

function handleNotificationResponse(data: any) {
    // Handle navigation based on notification type
    switch (data.type) {
        case 'new_task':
            // Navigate to tasks screen
            break;
        case 'class_reminder':
            // Navigate to dashboard
            break;
        case 'task_due':
            // Navigate to specific task
            break;
        default:
            break;
    }
}
