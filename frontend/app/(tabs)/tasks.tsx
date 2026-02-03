import { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    RefreshControl,
    Alert,
    ActivityIndicator,
    Modal
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { api } from '@/services/api';

type FilterTab = 'all' | 'today' | 'upcoming';

export default function TasksScreen() {
    const [activeTab, setActiveTab] = useState<FilterTab>('all');
    const [search, setSearch] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [newTask, setNewTask] = useState({ title: '', description: '', dueDate: '' });
    const queryClient = useQueryClient();

    // Fetch tasks
    const { data: tasks, isLoading, refetch } = useQuery({
        queryKey: ['tasks', activeTab, search],
        queryFn: () => api.getTasks({
            date: activeTab !== 'all' ? activeTab : undefined,
            search: search || undefined
        })
    });

    // Complete task mutation
    const completeMutation = useMutation({
        mutationFn: (id: string) => api.completeTask(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }
    });

    // Create task mutation
    const createMutation = useMutation({
        mutationFn: (data: any) => api.createTask(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            setShowAddModal(false);
            setNewTask({ title: '', description: '', dueDate: '' });
        }
    });

    // AI Schedule mutation
    const aiScheduleMutation = useMutation({
        mutationFn: () => api.aiScheduleAllTasks(),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            Alert.alert('IA', `Se programaron ${data.suggestions?.length || 0} tareas`);
        },
        onError: () => {
            Alert.alert('Error', 'No se pudo obtener sugerencias de IA');
        }
    });

    const onRefresh = useCallback(() => refetch(), []);

    const handleCreateTask = () => {
        if (!newTask.title) {
            Alert.alert('Error', 'El título es requerido');
            return;
        }
        createMutation.mutate({
            title: newTask.title,
            description: newTask.description || undefined,
            dueDate: newTask.dueDate ? new Date(newTask.dueDate).toISOString() : undefined
        });
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'URGENT': return '#EA4335';
            case 'HIGH': return '#FBBC04';
            case 'MEDIUM': return '#4285F4';
            default: return '#34A853';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'COMPLETED':
            case 'SUBMITTED':
                return 'checkmark-circle';
            case 'IN_PROGRESS':
                return 'time';
            default:
                return 'ellipse-outline';
        }
    };

    return (
        <View style={styles.container}>
            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <Ionicons name="search" size={20} color="#666" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Buscar tareas..."
                        placeholderTextColor="#666"
                        value={search}
                        onChangeText={setSearch}
                    />
                    {search && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <Ionicons name="close-circle" size={20} color="#666" />
                        </TouchableOpacity>
                    )}
                </View>

                <TouchableOpacity
                    style={styles.aiButton}
                    onPress={() => aiScheduleMutation.mutate()}
                    disabled={aiScheduleMutation.isPending}
                >
                    {aiScheduleMutation.isPending ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Ionicons name="sparkles" size={20} color="#fff" />
                    )}
                </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                {(['all', 'today', 'upcoming'] as FilterTab[]).map(tab => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.activeTab]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                            {tab === 'all' ? 'Todas' : tab === 'today' ? 'Hoy' : 'Próximas'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Tasks List */}
            <ScrollView
                style={styles.tasksList}
                refreshControl={
                    <RefreshControl
                        refreshing={isLoading}
                        onRefresh={onRefresh}
                        tintColor="#4285F4"
                    />
                }
            >
                {tasks && tasks.length > 0 ? (
                    tasks.map((task: any) => (
                        <TouchableOpacity
                            key={task.id}
                            style={styles.taskCard}
                            onPress={() => completeMutation.mutate(task.id)}
                        >
                            <View style={styles.taskLeft}>
                                <Ionicons
                                    name={getStatusIcon(task.status)}
                                    size={24}
                                    color={task.status === 'COMPLETED' || task.status === 'SUBMITTED' ? '#34A853' : '#666'}
                                />
                            </View>

                            <View style={styles.taskContent}>
                                <View style={styles.taskHeader}>
                                    <Text style={[
                                        styles.taskTitle,
                                        (task.status === 'COMPLETED' || task.status === 'SUBMITTED') && styles.completedText
                                    ]}>
                                        {task.title}
                                    </Text>
                                    {task.isFromClassroom && (
                                        <View style={styles.classroomBadge}>
                                            <Ionicons name="school" size={12} color="#4285F4" />
                                        </View>
                                    )}
                                </View>

                                {task.course && (
                                    <Text style={styles.taskCourse}>{task.course.name}</Text>
                                )}

                                <View style={styles.taskMeta}>
                                    {task.dueDate && (
                                        <View style={styles.metaItem}>
                                            <Ionicons name="calendar-outline" size={12} color="#888" />
                                            <Text style={styles.metaText}>
                                                {format(new Date(task.dueDate), "d MMM", { locale: es })}
                                            </Text>
                                        </View>
                                    )}
                                    {task.suggestedTime && (
                                        <View style={[styles.metaItem, styles.aiSuggestion]}>
                                            <Ionicons name="sparkles" size={12} color="#FBBC04" />
                                            <Text style={[styles.metaText, { color: '#FBBC04' }]}>
                                                {task.suggestedTime}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>

                            <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(task.priority) }]} />
                        </TouchableOpacity>
                    ))
                ) : (
                    <View style={styles.emptyState}>
                        <Ionicons name="checkbox-outline" size={48} color="#666" />
                        <Text style={styles.emptyText}>No hay tareas</Text>
                    </View>
                )}

                <View style={{ height: 80 }} />
            </ScrollView>

            {/* FAB */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => setShowAddModal(true)}
            >
                <Ionicons name="add" size={28} color="#fff" />
            </TouchableOpacity>

            {/* Add Task Modal */}
            <Modal
                visible={showAddModal}
                animationType="slide"
                transparent
                onRequestClose={() => setShowAddModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Nueva Tarea</Text>
                            <TouchableOpacity onPress={() => setShowAddModal(false)}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.modalInput}
                            placeholder="Título de la tarea"
                            placeholderTextColor="#666"
                            value={newTask.title}
                            onChangeText={t => setNewTask(prev => ({ ...prev, title: t }))}
                        />

                        <TextInput
                            style={[styles.modalInput, styles.textArea]}
                            placeholder="Descripción (opcional)"
                            placeholderTextColor="#666"
                            value={newTask.description}
                            onChangeText={t => setNewTask(prev => ({ ...prev, description: t }))}
                            multiline
                            numberOfLines={3}
                        />

                        <TouchableOpacity
                            style={[styles.saveButton, createMutation.isPending && styles.buttonDisabled]}
                            onPress={handleCreateTask}
                            disabled={createMutation.isPending}
                        >
                            {createMutation.isPending ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.saveButtonText}>Guardar Tarea</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f0f23',
    },
    searchContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        paddingHorizontal: 12,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        height: 44,
        color: '#fff',
        fontSize: 15,
    },
    aiButton: {
        width: 44,
        height: 44,
        backgroundColor: '#9333EA',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabs: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 8,
    },
    tab: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#1a1a2e',
    },
    activeTab: {
        backgroundColor: '#4285F4',
    },
    tabText: {
        color: '#888',
        fontSize: 14,
        fontWeight: '500',
    },
    activeTabText: {
        color: '#fff',
    },
    tasksList: {
        flex: 1,
        padding: 16,
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
    taskLeft: {
        width: 24,
    },
    taskContent: {
        flex: 1,
    },
    taskHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    taskTitle: {
        fontSize: 15,
        fontWeight: '500',
        color: '#fff',
        flex: 1,
    },
    completedText: {
        textDecorationLine: 'line-through',
        color: '#666',
    },
    classroomBadge: {
        backgroundColor: 'rgba(66, 133, 244, 0.2)',
        padding: 4,
        borderRadius: 4,
    },
    taskCourse: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    taskMeta: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    aiSuggestion: {
        backgroundColor: 'rgba(251, 188, 4, 0.1)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    metaText: {
        fontSize: 12,
        color: '#888',
    },
    priorityDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
        gap: 12,
    },
    emptyText: {
        color: '#666',
        fontSize: 16,
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#4285F4',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1a1a2e',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    modalInput: {
        backgroundColor: '#0f0f23',
        borderRadius: 12,
        padding: 16,
        color: '#fff',
        fontSize: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#2a2a4e',
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    saveButton: {
        backgroundColor: '#4285F4',
        height: 52,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
