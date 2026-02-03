import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/stores/auth.store';

export default function Index() {
    const { isAuthenticated, isLoading } = useAuthStore();

    if (isLoading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#4285F4" />
                <Text style={styles.loadingText}>Cargando...</Text>
            </View>
        );
    }

    if (isAuthenticated) {
        return <Redirect href="/(tabs)" />;
    }

    return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0f0f23',
    },
    loadingText: {
        marginTop: 16,
        color: '#888',
        fontSize: 16,
    },
});
