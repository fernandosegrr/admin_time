import { prisma } from '../server.js';

interface PushMessage {
    title: string;
    body: string;
    data?: Record<string, any>;
}

class NotificationService {
    private async sendExpoPush(tokens: string[], message: PushMessage) {
        // Expo Push API endpoint
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(
                tokens.map(token => ({
                    to: token,
                    sound: 'default',
                    title: message.title,
                    body: message.body,
                    data: message.data || {}
                }))
            )
        });

        const result = await response.json();

        // Handle ticket errors (invalid tokens)
        if (result.data) {
            for (let i = 0; i < result.data.length; i++) {
                const ticket = result.data[i];
                if (ticket.status === 'error') {
                    if (ticket.details?.error === 'DeviceNotRegistered') {
                        // Mark token as inactive
                        await prisma.pushToken.updateMany({
                            where: { token: tokens[i] },
                            data: { isActive: false }
                        });
                    }
                }
            }
        }

        return result;
    }

    async sendToUser(userId: string, message: PushMessage) {
        // Check notification preferences
        const prefs = await prisma.notificationPreference.findUnique({
            where: { userId }
        });

        // Check quiet hours
        if (prefs?.quietHoursEnabled && prefs.quietHoursStart && prefs.quietHoursEnd) {
            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            // Simple quiet hours check (doesn't handle midnight crossing)
            if (currentTime >= prefs.quietHoursStart || currentTime <= prefs.quietHoursEnd) {
                console.log(`Skipping notification for ${userId} - quiet hours`);
                return null;
            }
        }

        // Get active tokens
        const tokens = await prisma.pushToken.findMany({
            where: { userId, isActive: true }
        });

        if (tokens.length === 0) {
            console.log(`No active tokens for user ${userId}`);
            return null;
        }

        return this.sendExpoPush(tokens.map(t => t.token), message);
    }

    async sendNewTaskNotification(userId: string, taskTitle: string, courseName?: string) {
        const prefs = await prisma.notificationPreference.findUnique({
            where: { userId }
        });

        if (prefs && !prefs.newTasksEnabled) return null;

        return this.sendToUser(userId, {
            title: '📚 Nueva tarea de Classroom',
            body: courseName
                ? `${taskTitle} - ${courseName}`
                : taskTitle,
            data: { type: 'new_task' }
        });
    }

    async sendClassReminderNotification(userId: string, className: string, minutesBefore: number) {
        const prefs = await prisma.notificationPreference.findUnique({
            where: { userId }
        });

        if (prefs && !prefs.classRemindersEnabled) return null;

        return this.sendToUser(userId, {
            title: '📖 Clase próxima',
            body: `${className} comienza en ${minutesBefore} minutos`,
            data: { type: 'class_reminder' }
        });
    }

    async sendGymReminderNotification(userId: string) {
        const prefs = await prisma.notificationPreference.findUnique({
            where: { userId }
        });

        if (prefs && !prefs.gymRemindersEnabled) return null;

        return this.sendToUser(userId, {
            title: '💪 Hora del gym',
            body: 'Tu sesión de gym comienza pronto',
            data: { type: 'gym_reminder' }
        });
    }

    async sendPropedeuticoReminderNotification(userId: string, name: string) {
        const prefs = await prisma.notificationPreference.findUnique({
            where: { userId }
        });

        if (prefs && !prefs.propedeuticoEnabled) return null;

        return this.sendToUser(userId, {
            title: '📝 Propedéutico',
            body: `${name} comienza pronto`,
            data: { type: 'propedeutico_reminder' }
        });
    }

    async sendTaskDueNotification(userId: string, taskTitle: string, hoursLeft: number) {
        const prefs = await prisma.notificationPreference.findUnique({
            where: { userId }
        });

        if (hoursLeft <= 1 && prefs && !prefs.taskDue1hEnabled) return null;
        if (hoursLeft <= 24 && hoursLeft > 1 && prefs && !prefs.taskDue24hEnabled) return null;

        const timeText = hoursLeft <= 1
            ? '¡en menos de 1 hora!'
            : `en ${hoursLeft} horas`;

        return this.sendToUser(userId, {
            title: '⏰ Tarea por vencer',
            body: `"${taskTitle}" vence ${timeText}`,
            data: { type: 'task_due' }
        });
    }
}

export const notificationService = new NotificationService();
