import { useAuthStore } from '@/stores/auth.store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';

interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: any;
    headers?: Record<string, string>;
}

class ApiService {
    private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        const { accessToken, refreshToken, setTokens, logout } = useAuthStore.getState();

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const config: RequestInit = {
            method: options.method || 'GET',
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined
        };

        let response = await fetch(`${API_URL}${endpoint}`, config);

        // Handle token refresh
        if (response.status === 401 && refreshToken) {
            try {
                const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken })
                });

                if (refreshResponse.ok) {
                    const tokens = await refreshResponse.json();
                    setTokens(tokens.accessToken, tokens.refreshToken);

                    // Retry original request
                    headers['Authorization'] = `Bearer ${tokens.accessToken}`;
                    response = await fetch(`${API_URL}${endpoint}`, { ...config, headers });
                } else {
                    logout();
                    throw new Error('Session expired');
                }
            } catch {
                logout();
                throw new Error('Session expired');
            }
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || 'Request failed');
        }

        return response.json();
    }

    // Auth
    async login(email: string, password: string) {
        return this.request<{ user: any; accessToken: string; refreshToken: string }>(
            '/auth/login',
            { method: 'POST', body: { email, password } }
        );
    }

    async register(email: string, password: string, name: string) {
        return this.request<{ user: any; accessToken: string; refreshToken: string }>(
            '/auth/register',
            { method: 'POST', body: { email, password, name } }
        );
    }

    async getProfile() {
        return this.request<any>('/auth/me');
    }

    async updateProfile(data: { name?: string; email?: string; currentPassword?: string; newPassword?: string }) {
        return this.request<any>('/auth/profile', { method: 'PUT', body: data });
    }

    // Google
    async getGoogleAuthUrl() {
        return this.request<{ url: string }>('/google/auth-url');
    }

    async connectGoogle(data: { googleEmail?: string; authCode?: string }) {
        return this.request<any>('/google/connect', { method: 'POST', body: data });
    }

    async disconnectGoogle() {
        return this.request<any>('/google/disconnect', { method: 'POST' });
    }

    async syncGoogle() {
        return this.request<any>('/google/sync', { method: 'POST' });
    }

    async getGoogleStatus() {
        return this.request<any>('/google/status');
    }

    async getCourses() {
        return this.request<any[]>('/google/courses');
    }

    async updateCourse(id: string, data: any) {
        return this.request<any>(`/google/courses/${id}`, { method: 'PUT', body: data });
    }

    // Schedules
    async getClassSchedules() {
        return this.request<any[]>('/schedules/classes');
    }

    async createClassSchedule(data: any) {
        return this.request<any>('/schedules/classes', { method: 'POST', body: data });
    }

    async updateClassSchedule(id: string, data: any) {
        return this.request<any>(`/schedules/classes/${id}`, { method: 'PUT', body: data });
    }

    async deleteClassSchedule(id: string) {
        return this.request<any>(`/schedules/classes/${id}`, { method: 'DELETE' });
    }

    async importClassSchedules(data: any) {
        return this.request<any>('/schedules/classes/import', { method: 'POST', body: data });
    }

    async getGymSchedules() {
        return this.request<any[]>('/schedules/gym');
    }

    async createGymSchedule(data: any) {
        return this.request<any>('/schedules/gym', { method: 'POST', body: data });
    }

    async updateGymSchedule(id: string, data: any) {
        return this.request<any>(`/schedules/gym/${id}`, { method: 'PUT', body: data });
    }

    async deleteGymSchedule(id: string) {
        return this.request<any>(`/schedules/gym/${id}`, { method: 'DELETE' });
    }

    async skipGymDay(id: string, date: string) {
        return this.request<any>(`/schedules/gym/${id}/skip`, { method: 'POST', body: { date } });
    }

    async getPropedeuticoSchedules() {
        return this.request<any[]>('/schedules/propedeutico');
    }

    async createPropedeuticoSchedule(data: any) {
        return this.request<any>('/schedules/propedeutico', { method: 'POST', body: data });
    }

    async updatePropedeuticoSchedule(id: string, data: any) {
        return this.request<any>(`/schedules/propedeutico/${id}`, { method: 'PUT', body: data });
    }

    async deletePropedeuticoSchedule(id: string) {
        return this.request<any>(`/schedules/propedeutico/${id}`, { method: 'DELETE' });
    }

    async getAllSchedules() {
        return this.request<any>('/schedules/all');
    }

    async getDaySchedules(dayOfWeek: number) {
        return this.request<any[]>(`/schedules/day/${dayOfWeek}`);
    }

    // Tasks
    async getTasks(params?: { status?: string; courseId?: string; date?: string; search?: string }) {
        const query = new URLSearchParams(params as any).toString();
        return this.request<any[]>(`/tasks${query ? `?${query}` : ''}`);
    }

    async getTask(id: string) {
        return this.request<any>(`/tasks/${id}`);
    }

    async createTask(data: any) {
        return this.request<any>('/tasks', { method: 'POST', body: data });
    }

    async updateTask(id: string, data: any) {
        return this.request<any>(`/tasks/${id}`, { method: 'PUT', body: data });
    }

    async deleteTask(id: string) {
        return this.request<any>(`/tasks/${id}`, { method: 'DELETE' });
    }

    async completeTask(id: string) {
        return this.request<any>(`/tasks/${id}/complete`, { method: 'POST' });
    }

    async aiScheduleTask(id: string) {
        return this.request<any>(`/tasks/${id}/ai-schedule`, { method: 'POST' });
    }

    async aiScheduleAllTasks() {
        return this.request<any>('/tasks/ai-schedule-all', { method: 'POST' });
    }

    async getTaskStats() {
        return this.request<any>('/tasks/stats/summary');
    }

    // Notifications
    async registerPushToken(token: string, platform: 'ios' | 'android') {
        return this.request<any>('/notifications/register-token', { method: 'POST', body: { token, platform } });
    }

    async getNotificationPreferences() {
        return this.request<any>('/notifications/preferences');
    }

    async updateNotificationPreferences(data: any) {
        return this.request<any>('/notifications/preferences', { method: 'PUT', body: data });
    }

    async testNotification() {
        return this.request<any>('/notifications/test', { method: 'POST' });
    }
}

export const api = new ApiService();
