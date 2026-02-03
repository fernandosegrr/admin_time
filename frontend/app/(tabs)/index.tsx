import { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function DashboardScreen() {
    const { user } = useAuthStore();
    const today = new Date();
    const dayOfWeek = today.getDay();
    const [refreshing, setRefreshing] = useState(false);

    // Fetch today's schedules
    const { data: schedules, isLoading: schedulesLoading, refetch: refetchSchedules } = useQuery({
        queryKey: ['schedules', 'day', dayOfWeek],
        queryFn: () => api.getDaySchedules(dayOfWeek)
    });

    // Fetch today's tasks
    const { data: tasks, isLoading: tasksLoading, refetch: refetchTasks } = useQuery({
        queryKey: ['tasks', 'today'],
        queryFn: () => api.getTasks({ date: 'today' })
    });

    // Fetch task stats
    const { data: stats } = useQuery({
        queryKey: ['tasks', 'stats'],
        queryFn: () => api.getTaskStats()
    });

    // Fetch Google status
    const { data: googleStatus } = useQuery({
        queryKey: ['google', 'status'],
        queryFn: () => api.getGoogleStatus()
    });

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([refetchSchedules(), refetchTasks()]);
        if (googleStatus?.connected) {
            try {
                await api.syncGoogle();
                await refetchTasks();
            } catch { }
        }
        setRefreshing(false);
    }, [googleStatus]);

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'class': return 'book-outline';
            case 'gym': return 'barbell-outline';
            case 'propedeutico': return 'school-outline';
            default: return 'time-outline';
        }
    };

    const getTypeName = (type: string) => {
        switch (type) {
            case 'class': return 'Clase';
            case 'gym': return 'Gym';
            case 'propedeutico': return 'Propedéutico';
            default: return 'Evento';
        }
    };

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor="#4285F4"
                    colors={['#4285F4']}
                />
            }
        >
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Hola, {user?.name?.split(' ')[0]} 👋</Text>
                    <Text style={styles.date}>
                        {DAYS[dayOfWeek]}, {format(today, "d 'de' MMMM", { locale: es })}
                    </Text>
                </View>
                {googleStatus?.connected && (
                    <View style={styles.syncBadge}>
                        <Ionicons name="sync" size={14} color="#34A853" />
                        <Text style={styles.syncText}>Conectado</Text>
                    </View>
                )}
            </View>

            {/* Stats Cards */}
            <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: '#1a3a5c' }]}>
                    <Text style={styles.statNumber}>{stats?.pending || 0}</Text>
                    <Text style={styles.statLabel}>Pendientes</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: '#3a1a5c' }]}>
                    <Text style={styles.statNumber}>{stats?.dueToday || 0}</Text>
                    <Text style={styles.statLabel}>Para hoy</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: '#5c1a3a' }]}>
                    <Text style={styles.statNumber}>{stats?.overdue || 0}</Text>
                    <Text style={styles.statLabel}>Vencidas</Text>
                </View>
            </View>

            {/* Today's Schedule */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>📅 Horario de hoy</Text>

                {schedulesLoading ? (
                    <ActivityIndicator color="#4285F4" style={styles.loader} />
                ) : schedules && schedules.length > 0 ? (
                    schedules.map((item: any) => (
                        <View
                            key={item.id}
                            style={[styles.scheduleCard, { borderLeftColor: item.color || '#4285F4' }]}
                        >
                            <View style={styles.scheduleTime}>
                                <Text style={styles.timeText}>{item.startTime}</Text>
                                <Text style={styles.timeSeparator}>-</Text>
                                <Text style={styles.timeText}>{item.endTime}</Text>
                            </View>
                            <View style={styles.scheduleInfo}>
                                <View style={styles.scheduleHeader}>
                                    <Ionicons name={getTypeIcon(item.type)} size={16} color="#888" />
                                    <Text style={styles.scheduleType}>{getTypeName(item.type)}</Text>
                                </View>
                                <Text style={styles.scheduleName}>{item.name}</Text>
                                {item.classroom && (
                                    <Text style={styles.scheduleLocation}>📍 {item.classroom}</Text>
                                )}
                            </View>
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyCard}>
                        <Ionicons name="sunny-outline" size={32} color="#666" />
                        <Text style={styles.emptyText}>No tienes actividades hoy</Text>
                    </View>
                )}
            </View>

            {/* Today's Tasks */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>✅ Tareas para hoy</Text>

                {tasksLoading ? (
                    <ActivityIndicator color="#4285F4" style={styles.loader} />
                ) : tasks && tasks.length > 0 ? (
                    tasks.slice(0, 5).map((task: any) => (
                        <TouchableOpacity
                            key={task.id}
                            style={styles.taskCard}
                        >
                            <View style={[
                                styles.taskStatus,
                                { backgroundColor: task.status === 'COMPLETED' ? '#34A853' : '#666' }
                            ]} />
                            <View style={styles.taskContent}>
                                <Text style={[
                                    styles.taskTitle,
                                    task.status === 'COMPLETED' && styles.taskCompleted
                                ]}>
                                    {task.title}
                                </Text>
                                {task.course && (
                                    <Text style={styles.taskCourse}>{task.course.name}</Text>
                                )}
                            </View>
                            {task.isFromClassroom && (
                                <Ionicons name="school" size={16} color="#4285F4" />
                            )}
                        </TouchableOpacity>
                    ))
                ) : (
                    <View style={styles.emptyCard}>
                        <Ionicons name="checkmark-done-outline" size={32} color="#34A853" />
                        <Text style={styles.emptyText}>No tienes tareas para hoy</Text>
                    </View>
                )}
            </View>

            <View style={{ height: 32 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f0f23',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingTop: 16,
    },
    greeting: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    date: {
        fontSize: 14,
        color: '#888',
        marginTop: 4,
    },
    syncBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(52, 168, 83, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 4,
    },
    syncText: {
        color: '#34A853',
        fontSize: 12,
        fontWeight: '500',
    },
    statsRow: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 12,
        marginBottom: 24,
    },
    statCard: {
        flex: 1,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
    },
    statLabel: {
        fontSize: 12,
        color: '#aaa',
        marginTop: 4,
    },
    section: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 16,
    },
    loader: {
        padding: 20,
    },
    scheduleCard: {
        flexDirection: 'row',
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
    },
    scheduleTime: {
        marginRight: 16,
        alignItems: 'center',
    },
    timeText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    timeSeparator: {
        color: '#666',
        fontSize: 12,
    },
    scheduleInfo: {
        flex: 1,
    },
    scheduleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    scheduleType: {
        fontSize: 12,
        color: '#888',
    },
    scheduleName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    scheduleLocation: {
        fontSize: 12,
        color: '#888',
        marginTop: 4,
    },
    taskCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
        gap: 12,
    },
    taskStatus: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    taskContent: {
        flex: 1,
    },
    taskTitle: {
        fontSize: 15,
        color: '#fff',
        fontWeight: '500',
    },
    taskCompleted: {
        textDecorationLine: 'line-through',
        color: '#666',
    },
    taskCourse: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    emptyCard: {
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        padding: 32,
        alignItems: 'center',
        gap: 12,
    },
    emptyText: {
        color: '#666',
        fontSize: 14,
    },
});
