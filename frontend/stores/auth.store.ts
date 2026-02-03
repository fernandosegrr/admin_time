import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
    id: string;
    email: string;
    name: string;
    googleConnected?: boolean;
}

interface AuthState {
    accessToken: string | null;
    refreshToken: string | null;
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;

    // Actions
    setTokens: (accessToken: string, refreshToken: string) => void;
    setUser: (user: User | null) => void;
    logout: () => void;
    setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            accessToken: null,
            refreshToken: null,
            user: null,
            isAuthenticated: false,
            isLoading: true,

            setTokens: (accessToken, refreshToken) =>
                set({ accessToken, refreshToken, isAuthenticated: true }),

            setUser: (user) => set({ user }),

            logout: () => set({
                accessToken: null,
                refreshToken: null,
                user: null,
                isAuthenticated: false
            }),

            setLoading: (isLoading) => set({ isLoading })
        }),
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => AsyncStorage),
            onRehydrateStorage: () => (state) => {
                state?.setLoading(false);
            }
        }
    )
);
