import { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Switch,
    Alert,
    ActivityIndicator,
    TextInput
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';

export default function SettingsScreen() {
    const { user, logout } = useAuthStore();
    const [googleEmail, setGoogleEmail] = useState('');
    const queryClient = useQueryClient();

    // Google status
    const { data: googleStatus, isLoading: googleLoading } = useQuery({
        queryKey: ['google', 'status'],
        queryFn: () => api.getGoogleStatus()
    });

    // Notification preferences
    const { data: notifPrefs, isLoading: prefsLoading } = useQuery({
        queryKey: ['notifications', 'preferences'],
        queryFn: () => api.getNotificationPreferences()
    });

    // Connect Google (email-only mode for blocked schools)
    const connectGoogleMutation = useMutation({
        mutationFn: (email: string) => api.connectGoogle({ googleEmail: email }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['google'] });
            setGoogleEmail('');
            Alert.alert('Éxito', 'Email de Google conectado');
        },
        onError: (error: any) => {
            Alert.alert('Error', error.message);
        }
    });

    // Disconnect Google
    const disconnectMutation = useMutation({
        mutationFn: () => api.disconnectGoogle(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['google'] });
            Alert.alert('Desconectado', 'Google Classroom desconectado');
        }
    });

    // Sync
    const syncMutation = useMutation({
        mutationFn: () => api.syncGoogle(),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            Alert.alert('Sincronizado', `${result.coursesUpdated} cursos, ${result.newTasks} tareas nuevas`);
        }
    });

    // Update preferences
    const updatePrefsMutation = useMutation({
        mutationFn: (data: any) => api.updateNotificationPreferences(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications', 'preferences'] });
        }
    });

    // Test notification
    const testNotifMutation = useMutation({
        mutationFn: () => api.testNotification(),
        onSuccess: () => {
            Alert.alert('Enviada', 'Notificación de prueba enviada');
        }
    });

    const handleLogout = () => {
        Alert.alert(
            'Cerrar Sesión',
            '¿Estás seguro de que quieres salir?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Salir',
                    style: 'destructive',
                    onPress: () => {
                        logout();
                        router.replace('/(auth)/login');
                    }
                }
            ]
        );
    };

    const togglePref = (key: string, value: boolean) => {
        updatePrefsMutation.mutate({ [key]: value });
    };

    return (
        <ScrollView style={styles.container}>
            {/* Profile Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Perfil</Text>
                <View style={styles.profileCard}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                        </Text>
                    </View>
                    <View style={styles.profileInfo}>
                        <Text style={styles.profileName}>{user?.name}</Text>
                        <Text style={styles.profileEmail}>{user?.email}</Text>
                    </View>
                </View>
            </View>

            {/* Google Classroom Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Google Classroom</Text>

                {googleLoading ? (
                    <ActivityIndicator color="#4285F4" />
                ) : googleStatus?.connected ? (
                    <View style={styles.card}>
                        <View style={styles.connectedBadge}>
                            <Ionicons name="checkmark-circle" size={20} color="#34A853" />
                            <Text style={styles.connectedText}>
                                {googleStatus.mode === 'oauth' ? 'Conectado' : 'Email vinculado'}
                            </Text>
                        </View>

                        {googleStatus.googleEmail && (
                            <Text style={styles.googleEmail}>{googleStatus.googleEmail}</Text>
                        )}

                        <Text style={styles.syncInfo}>
                            📚 {googleStatus.coursesCount} cursos
                            {googleStatus.lastSyncAt && (
                                <Text> • Última sync: {new Date(googleStatus.lastSyncAt).toLocaleDateString()}</Text>
                            )}
                        </Text>

                        <View style={styles.buttonRow}>
                            <TouchableOpacity
                                style={styles.syncButton}
                                onPress={() => syncMutation.mutate()}
                                disabled={syncMutation.isPending || googleStatus.mode !== 'oauth'}
                            >
                                {syncMutation.isPending ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons name="sync" size={18} color="#fff" />
                                        <Text style={styles.syncButtonText}>Sincronizar</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.disconnectButton}
                                onPress={() => disconnectMutation.mutate()}
                            >
                                <Text style={styles.disconnectButtonText}>Desconectar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View style={styles.card}>
                        <Text style={styles.cardText}>
                            Conecta tu cuenta de Google para sincronizar tareas de Classroom.
                        </Text>

                        <Text style={styles.inputLabel}>
                            Email de Google (para escuelas con OAuth bloqueado):
                        </Text>
                        <TextInput
                            style={styles.input}
                            placeholder="tu.correo@escuela.edu"
                            placeholderTextColor="#666"
                            value={googleEmail}
                            onChangeText={setGoogleEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />

                        <TouchableOpacity
                            style={[styles.connectButton, connectGoogleMutation.isPending && styles.buttonDisabled]}
                            onPress={() => {
                                if (googleEmail) {
                                    connectGoogleMutation.mutate(googleEmail);
                                } else {
                                    Alert.alert('Error', 'Ingresa tu email de Google');
                                }
                            }}
                            disabled={connectGoogleMutation.isPending}
                        >
                            {connectGoogleMutation.isPending ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="logo-google" size={18} color="#fff" />
                                    <Text style={styles.connectButtonText}>Conectar Email</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Notifications Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notificaciones</Text>

                {prefsLoading ? (
                    <ActivityIndicator color="#4285F4" />
                ) : (
                    <View style={styles.card}>
                        <View style={styles.prefRow}>
                            <View style={styles.prefInfo}>
                                <Ionicons name="notifications-outline" size={20} color="#4285F4" />
                                <Text style={styles.prefText}>Nuevas tareas de Classroom</Text>
                            </View>
                            <Switch
                                value={notifPrefs?.newTasksEnabled ?? true}
                                onValueChange={(v) => togglePref('newTasksEnabled', v)}
                                trackColor={{ false: '#3e3e3e', true: '#4285F4' }}
                            />
                        </View>

                        <View style={styles.prefRow}>
                            <View style={styles.prefInfo}>
                                <Ionicons name="book-outline" size={20} color="#34A853" />
                                <Text style={styles.prefText}>Recordatorio de clases (15min)</Text>
                            </View>
                            <Switch
                                value={notifPrefs?.classRemindersEnabled ?? true}
                                onValueChange={(v) => togglePref('classRemindersEnabled', v)}
                                trackColor={{ false: '#3e3e3e', true: '#34A853' }}
                            />
                        </View>

                        <View style={styles.prefRow}>
                            <View style={styles.prefInfo}>
                                <Ionicons name="barbell-outline" size={20} color="#FBBC04" />
                                <Text style={styles.prefText}>Recordatorio de gym</Text>
                            </View>
                            <Switch
                                value={notifPrefs?.gymRemindersEnabled ?? true}
                                onValueChange={(v) => togglePref('gymRemindersEnabled', v)}
                                trackColor={{ false: '#3e3e3e', true: '#FBBC04' }}
                            />
                        </View>

                        <View style={styles.prefRow}>
                            <View style={styles.prefInfo}>
                                <Ionicons name="alarm-outline" size={20} color="#EA4335" />
                                <Text style={styles.prefText}>Tareas por vencer (24h)</Text>
                            </View>
                            <Switch
                                value={notifPrefs?.taskDue24hEnabled ?? true}
                                onValueChange={(v) => togglePref('taskDue24hEnabled', v)}
                                trackColor={{ false: '#3e3e3e', true: '#EA4335' }}
                            />
                        </View>

                        <View style={styles.prefRow}>
                            <View style={styles.prefInfo}>
                                <Ionicons name="warning-outline" size={20} color="#EA4335" />
                                <Text style={styles.prefText}>Tareas urgentes (1h)</Text>
                            </View>
                            <Switch
                                value={notifPrefs?.taskDue1hEnabled ?? true}
                                onValueChange={(v) => togglePref('taskDue1hEnabled', v)}
                                trackColor={{ false: '#3e3e3e', true: '#EA4335' }}
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.testButton}
                            onPress={() => testNotifMutation.mutate()}
                            disabled={testNotifMutation.isPending}
                        >
                            {testNotifMutation.isPending ? (
                                <ActivityIndicator size="small" color="#4285F4" />
                            ) : (
                                <>
                                    <Ionicons name="paper-plane-outline" size={18} color="#4285F4" />
                                    <Text style={styles.testButtonText}>Enviar notificación de prueba</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Logout */}
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={20} color="#EA4335" />
                <Text style={styles.logoutText}>Cerrar Sesión</Text>
            </TouchableOpacity>

            {/* Version */}
            <Text style={styles.version}>Gestión de Tiempo v1.0.0</Text>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f0f23',
    },
    section: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#888',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        padding: 16,
        gap: 16,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#4285F4',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    profileInfo: {
        flex: 1,
    },
    profileName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    profileEmail: {
        fontSize: 14,
        color: '#888',
        marginTop: 2,
    },
    card: {
        backgroundColor: '#1a1a2e',
        borderRadius: 12,
        padding: 16,
    },
    cardText: {
        color: '#aaa',
        fontSize: 14,
        marginBottom: 16,
    },
    inputLabel: {
        color: '#888',
        fontSize: 12,
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#0f0f23',
        borderRadius: 10,
        padding: 14,
        color: '#fff',
        fontSize: 15,
        borderWidth: 1,
        borderColor: '#2a2a4e',
        marginBottom: 12,
    },
    connectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#4285F4',
        paddingVertical: 14,
        borderRadius: 10,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    connectButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    connectedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    connectedText: {
        color: '#34A853',
        fontSize: 16,
        fontWeight: '600',
    },
    googleEmail: {
        color: '#888',
        fontSize: 14,
        marginBottom: 8,
    },
    syncInfo: {
        color: '#888',
        fontSize: 13,
        marginBottom: 16,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
    },
    syncButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#4285F4',
        paddingVertical: 12,
        borderRadius: 10,
    },
    syncButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    disconnectButton: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: 'rgba(234, 67, 53, 0.1)',
        borderWidth: 1,
        borderColor: '#EA4335',
    },
    disconnectButtonText: {
        color: '#EA4335',
        fontSize: 14,
        fontWeight: '500',
    },
    prefRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#2a2a4e',
    },
    prefInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    prefText: {
        color: '#fff',
        fontSize: 14,
    },
    testButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        marginTop: 12,
        borderRadius: 10,
        backgroundColor: 'rgba(66, 133, 244, 0.1)',
        borderWidth: 1,
        borderColor: '#4285F4',
    },
    testButtonText: {
        color: '#4285F4',
        fontSize: 14,
        fontWeight: '500',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: 'rgba(234, 67, 53, 0.1)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#EA4335',
    },
    logoutText: {
        color: '#EA4335',
        fontSize: 15,
        fontWeight: '600',
    },
    version: {
        textAlign: 'center',
        color: '#666',
        fontSize: 12,
        marginTop: 16,
    },
});
