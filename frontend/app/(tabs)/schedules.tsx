import { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    Modal
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/services/api';
import * as DocumentPicker from 'expo-document-picker';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const COLORS = ['#4285F4', '#34A853', '#FBBC04', '#EA4335', '#9333EA', '#EC4899', '#06B6D4'];

type ScheduleType = 'classes' | 'gym' | 'propedeutico';

export default function SchedulesScreen() {
    const [activeType, setActiveType] = useState<ScheduleType>('classes');
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [formData, setFormData] = useState({
        name: '',
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '10:00',
        color: '#4285F4',
        classroom: '',
        location: '',
        teacher: ''
    });

    const queryClient = useQueryClient();

    // Fetch schedules
    const { data: allSchedules, isLoading } = useQuery({
        queryKey: ['schedules', 'all'],
        queryFn: () => api.getAllSchedules()
    });

    const schedules = allSchedules?.[activeType] || [];

    // Mutations
    const createMutation = useMutation({
        mutationFn: (data: any) => {
            if (activeType === 'classes') return api.createClassSchedule(data);
            if (activeType === 'gym') return api.createGymSchedule(data);
            return api.createPropedeuticoSchedule(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedules'] });
            closeModal();
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => {
            if (activeType === 'classes') return api.updateClassSchedule(id, data);
            if (activeType === 'gym') return api.updateGymSchedule(id, data);
            return api.updatePropedeuticoSchedule(id, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedules'] });
            closeModal();
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => {
            if (activeType === 'classes') return api.deleteClassSchedule(id);
            if (activeType === 'gym') return api.deleteGymSchedule(id);
            return api.deletePropedeuticoSchedule(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedules'] });
        }
    });

    const importMutation = useMutation({
        mutationFn: (data: any) => api.importClassSchedules(data),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['schedules'] });
            Alert.alert('Éxito', `Se importaron ${result.imported} clases`);
        }
    });

    const closeModal = () => {
        setShowModal(false);
        setEditingItem(null);
        setFormData({
            name: '',
            dayOfWeek: 1,
            startTime: '08:00',
            endTime: '10:00',
            color: '#4285F4',
            classroom: '',
            location: '',
            teacher: ''
        });
    };

    const openEditModal = (item: any) => {
        setEditingItem(item);
        setFormData({
            name: item.name,
            dayOfWeek: item.dayOfWeek,
            startTime: item.startTime,
            endTime: item.endTime,
            color: item.color || '#4285F4',
            classroom: item.classroom || '',
            location: item.location || '',
            teacher: item.teacher || ''
        });
        setShowModal(true);
    };

    const handleSave = () => {
        if (!formData.name) {
            Alert.alert('Error', 'El nombre es requerido');
            return;
        }

        const data = { ...formData };

        if (editingItem) {
            updateMutation.mutate({ id: editingItem.id, data });
        } else {
            createMutation.mutate(data);
        }
    };

    const handleDelete = (id: string) => {
        Alert.alert(
            'Eliminar',
            '¿Estás seguro de eliminar este horario?',
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: () => deleteMutation.mutate(id) }
            ]
        );
    };

    const handleImportJSON = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json'
            });

            if (!result.canceled && result.assets[0]) {
                const response = await fetch(result.assets[0].uri);
                const json = await response.json();
                importMutation.mutate(json);
            }
        } catch (error) {
            Alert.alert('Error', 'No se pudo importar el archivo');
        }
    };

    const getTypeIcon = () => {
        switch (activeType) {
            case 'classes': return 'book-outline';
            case 'gym': return 'barbell-outline';
            case 'propedeutico': return 'school-outline';
        }
    };

    const getTypeName = () => {
        switch (activeType) {
            case 'classes': return 'Clases';
            case 'gym': return 'Gym';
            case 'propedeutico': return 'Propedéutico';
        }
    };

    return (
        <View style={styles.container}>
            {/* Type Selector */}
            <View style={styles.typeTabs}>
                {(['classes', 'gym', 'propedeutico'] as ScheduleType[]).map(type => (
                    <TouchableOpacity
                        key={type}
                        style={[styles.typeTab, activeType === type && styles.activeTypeTab]}
                        onPress={() => setActiveType(type)}
                    >
                        <Ionicons
                            name={type === 'classes' ? 'book-outline' : type === 'gym' ? 'barbell-outline' : 'school-outline'}
                            size={18}
                            color={activeType === type ? '#fff' : '#888'}
                        />
                        <Text style={[styles.typeTabText, activeType === type && styles.activeTypeTabText]}>
                            {type === 'classes' ? 'Clases' : type === 'gym' ? 'Gym' : 'Propedéutico'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Import Button (only for classes) */}
            {activeType === 'classes' && (
                <TouchableOpacity style={styles.importButton} onPress={handleImportJSON}>
                    <Ionicons name="document-outline" size={18} color="#4285F4" />
                    <Text style={styles.importButtonText}>Importar JSON</Text>
                </TouchableOpacity>
            )}

            {/* Schedule List */}
            <ScrollView style={styles.list}>
                {isLoading ? (
                    <ActivityIndicator color="#4285F4" style={{ padding: 20 }} />
                ) : schedules.length > 0 ? (
                    schedules.map((item: any) => (
                        <TouchableOpacity
                            key={item.id}
                            style={[styles.scheduleCard, { borderLeftColor: item.color || '#4285F4' }]}
                            onPress={() => openEditModal(item)}
                            onLongPress={() => handleDelete(item.id)}
                        >
                            <View style={styles.scheduleHeader}>
                                <Text style={styles.scheduleName}>{item.name}</Text>
                                <View style={[styles.dayBadge, { backgroundColor: item.color + '20' }]}>
                                    <Text style={[styles.dayBadgeText, { color: item.color }]}>
                                        {DAYS[item.dayOfWeek]}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.scheduleTime}>
                                <Ionicons name="time-outline" size={14} color="#888" />
                                <Text style={styles.scheduleTimeText}>
                                    {item.startTime} - {item.endTime}
                                </Text>
                            </View>

                            {(item.classroom || item.location) && (
                                <View style={styles.scheduleLocation}>
                                    <Ionicons name="location-outline" size={14} color="#888" />
                                    <Text style={styles.scheduleLocationText}>
                                        {item.classroom || item.location}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    ))
                ) : (
                    <View style={styles.emptyState}>
                        <Ionicons name={getTypeIcon()} size={48} color="#666" />
                        <Text style={styles.emptyText}>No hay {getTypeName().toLowerCase()}</Text>
                    </View>
                )}

                <View style={{ height: 80 }} />
            </ScrollView>

            {/* FAB */}
            <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
                <Ionicons name="add" size={28} color="#fff" />
            </TouchableOpacity>

            {/* Add/Edit Modal */}
            <Modal
                visible={showModal}
                animationType="slide"
                transparent
                onRequestClose={closeModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingItem ? 'Editar' : 'Nuevo'} {getTypeName().slice(0, -1)}
                            </Text>
                            <TouchableOpacity onPress={closeModal}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView>
                            <Text style={styles.inputLabel}>Nombre</Text>
                            <TextInput
                                style={styles.input}
                                placeholder={`Nombre de ${activeType === 'classes' ? 'la clase' : 'la actividad'}`}
                                placeholderTextColor="#666"
                                value={formData.name}
                                onChangeText={t => setFormData(prev => ({ ...prev, name: t }))}
                            />

                            <Text style={styles.inputLabel}>Día de la semana</Text>
                            <View style={styles.daysRow}>
                                {DAYS.map((day, i) => (
                                    <TouchableOpacity
                                        key={i}
                                        style={[styles.dayButton, formData.dayOfWeek === i && styles.activeDayButton]}
                                        onPress={() => setFormData(prev => ({ ...prev, dayOfWeek: i }))}
                                    >
                                        <Text style={[styles.dayButtonText, formData.dayOfWeek === i && styles.activeDayButtonText]}>
                                            {day}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={styles.timeRow}>
                                <View style={styles.timeField}>
                                    <Text style={styles.inputLabel}>Inicio</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="08:00"
                                        placeholderTextColor="#666"
                                        value={formData.startTime}
                                        onChangeText={t => setFormData(prev => ({ ...prev, startTime: t }))}
                                    />
                                </View>
                                <View style={styles.timeField}>
                                    <Text style={styles.inputLabel}>Fin</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="10:00"
                                        placeholderTextColor="#666"
                                        value={formData.endTime}
                                        onChangeText={t => setFormData(prev => ({ ...prev, endTime: t }))}
                                    />
                                </View>
                            </View>

                            <Text style={styles.inputLabel}>Color</Text>
                            <View style={styles.colorsRow}>
                                {COLORS.map(color => (
                                    <TouchableOpacity
                                        key={color}
                                        style={[
                                            styles.colorButton,
                                            { backgroundColor: color },
                                            formData.color === color && styles.activeColorButton
                                        ]}
                                        onPress={() => setFormData(prev => ({ ...prev, color }))}
                                    />
                                ))}
                            </View>

                            {activeType === 'classes' && (
                                <>
                                    <Text style={styles.inputLabel}>Aula (opcional)</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Ej: Aula 101"
                                        placeholderTextColor="#666"
                                        value={formData.classroom}
                                        onChangeText={t => setFormData(prev => ({ ...prev, classroom: t }))}
                                    />

                                    <Text style={styles.inputLabel}>Profesor (opcional)</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Nombre del profesor"
                                        placeholderTextColor="#666"
                                        value={formData.teacher}
                                        onChangeText={t => setFormData(prev => ({ ...prev, teacher: t }))}
                                    />
                                </>
                            )}

                            {(activeType === 'gym' || activeType === 'propedeutico') && (
                                <>
                                    <Text style={styles.inputLabel}>Ubicación (opcional)</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Ubicación"
                                        placeholderTextColor="#666"
                                        value={formData.location}
                                        onChangeText={t => setFormData(prev => ({ ...prev, location: t }))}
                                    />
                                </>
                            )}
                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.saveButton, (createMutation.isPending || updateMutation.isPending) && styles.buttonDisabled]}
                            onPress={handleSave}
                            disabled={createMutation.isPending || updateMutation.isPending}
                        >
                            {(createMutation.isPending || updateMutation.isPending) ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.saveButtonText}>
                                    {editingItem ? 'Guardar Cambios' : 'Crear'}
                                </Text>
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
    typeTabs: {
        flexDirection: 'row',
        padding: 16,
        gap: 8,
    },
    typeTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#1a1a2e',
    },
    activeTypeTab: {
        backgroundColor: '#4285F4',
    },
    typeTabText: {
        color: '#888',
        fontSize: 13,
        fontWeight: '500',
    },
    activeTypeTabText: {
        color: '#fff',
    },
    importButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'rgba(66, 133, 244, 0.1)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#4285F4',
        borderStyle: 'dashed',
    },
    importButtonText: {
        color: '#4285F4',
        fontSize: 14,
        fontWeight: '500',
    },
    list: {
        flex: 1,
        padding: 16,
    },
    scheduleCard: {
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
    },
    scheduleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    scheduleName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        flex: 1,
    },
    dayBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    dayBadgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    scheduleTime: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    scheduleTimeText: {
        color: '#888',
        fontSize: 13,
    },
    scheduleLocation: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    scheduleLocationText: {
        color: '#888',
        fontSize: 13,
    },
    emptyState: {
        alignItems: 'center',
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
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    inputLabel: {
        color: '#888',
        fontSize: 13,
        marginBottom: 6,
        marginTop: 12,
    },
    input: {
        backgroundColor: '#0f0f23',
        borderRadius: 10,
        padding: 14,
        color: '#fff',
        fontSize: 15,
        borderWidth: 1,
        borderColor: '#2a2a4e',
    },
    daysRow: {
        flexDirection: 'row',
        gap: 6,
    },
    dayButton: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        backgroundColor: '#0f0f23',
        borderRadius: 8,
    },
    activeDayButton: {
        backgroundColor: '#4285F4',
    },
    dayButtonText: {
        color: '#888',
        fontSize: 12,
        fontWeight: '500',
    },
    activeDayButtonText: {
        color: '#fff',
    },
    timeRow: {
        flexDirection: 'row',
        gap: 12,
    },
    timeField: {
        flex: 1,
    },
    colorsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    colorButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    activeColorButton: {
        borderWidth: 3,
        borderColor: '#fff',
    },
    saveButton: {
        backgroundColor: '#4285F4',
        height: 52,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 24,
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
