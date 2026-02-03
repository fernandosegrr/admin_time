import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
    return (
        <Tabs
            screenOptions={{
                tabBarStyle: {
                    backgroundColor: '#1a1a2e',
                    borderTopColor: '#2a2a4e',
                    height: 60,
                    paddingBottom: 8,
                    paddingTop: 8,
                },
                tabBarActiveTintColor: '#4285F4',
                tabBarInactiveTintColor: '#666',
                headerStyle: { backgroundColor: '#1a1a2e' },
                headerTintColor: '#fff',
                headerTitleStyle: { fontWeight: 'bold' },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Hoy',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="today-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="weekly"
                options={{
                    title: 'Semana',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="calendar-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="tasks"
                options={{
                    title: 'Tareas',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="checkbox-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="schedules"
                options={{
                    title: 'Horarios',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="time-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Config',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="settings-outline" size={size} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}
