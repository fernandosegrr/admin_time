import { prisma } from '../server.js';
import { notificationService } from '../services/notification.service.js';

class ReminderJob {
    private getDayOfWeek(): number {
        return new Date().getDay(); // 0=Sunday, 1=Monday, etc.
    }

    private getCurrentTime(): string {
        const now = new Date();
        return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    }

    private getTimeInMinutes(time: string): number {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }

    private isWithinMinutesBefore(targetTime: string, minutesBefore: number): boolean {
        const now = this.getCurrentTime();
        const nowMinutes = this.getTimeInMinutes(now);
        const targetMinutes = this.getTimeInMinutes(targetTime);

        const diff = targetMinutes - nowMinutes;
        return diff > 0 && diff <= minutesBefore;
    }

    async run() {
        const today = this.getDayOfWeek();
        const todayStr = new Date().toISOString().split('T')[0];

        // Get all users with preferences
        const users = await prisma.user.findMany({
            include: {
                notificationPrefs: true,
                pushTokens: {
                    where: { isActive: true }
                }
            }
        });

        for (const user of users) {
            // Skip users without active push tokens
            if (user.pushTokens.length === 0) continue;

            const prefs = user.notificationPrefs;
            const reminderMinutes = prefs?.classReminderMinutes || 15;

            // Check class reminders
            if (prefs?.classRemindersEnabled !== false) {
                const classes = await prisma.classSchedule.findMany({
                    where: {
                        userId: user.id,
                        dayOfWeek: today,
                        isActive: true
                    }
                });

                for (const cls of classes) {
                    if (this.isWithinMinutesBefore(cls.startTime, reminderMinutes)) {
                        await notificationService.sendClassReminderNotification(
                            user.id,
                            cls.name,
                            reminderMinutes
                        );
                    }
                }
            }

            // Check gym reminders
            if (prefs?.gymRemindersEnabled !== false) {
                const gymSchedules = await prisma.gymSchedule.findMany({
                    where: {
                        userId: user.id,
                        dayOfWeek: today,
                        isActive: true
                    }
                });

                for (const gym of gymSchedules) {
                    // Skip if today is marked as skipped
                    if (gym.skippedDates.includes(todayStr)) continue;

                    if (this.isWithinMinutesBefore(gym.startTime, 15)) {
                        await notificationService.sendGymReminderNotification(user.id);
                    }
                }
            }

            // Check propedéutico reminders
            if (prefs?.propedeuticoEnabled !== false) {
                const propSchedules = await prisma.propedeuticoSchedule.findMany({
                    where: {
                        userId: user.id,
                        dayOfWeek: today,
                        isActive: true
                    }
                });

                for (const prop of propSchedules) {
                    if (this.isWithinMinutesBefore(prop.startTime, 15)) {
                        await notificationService.sendPropedeuticoReminderNotification(
                            user.id,
                            prop.name
                        );
                    }
                }
            }

            // Check task due reminders
            await this.checkTaskDueReminders(user.id, prefs);
        }
    }

    private async checkTaskDueReminders(userId: string, prefs: any) {
        const now = new Date();

        // Get pending tasks with due dates
        const tasks = await prisma.task.findMany({
            where: {
                userId,
                status: { in: ['PENDING', 'IN_PROGRESS'] },
                dueDate: { not: null }
            }
        });

        for (const task of tasks) {
            if (!task.dueDate) continue;

            const hoursUntilDue = (task.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

            // 24 hour reminder
            if (prefs?.taskDue24hEnabled !== false && !task.notified24h) {
                if (hoursUntilDue <= 24 && hoursUntilDue > 23) {
                    await notificationService.sendTaskDueNotification(userId, task.title, 24);
                    await prisma.task.update({
                        where: { id: task.id },
                        data: { notified24h: true }
                    });
                }
            }

            // 1 hour reminder
            if (prefs?.taskDue1hEnabled !== false && !task.notified1h) {
                if (hoursUntilDue <= 1 && hoursUntilDue > 0) {
                    await notificationService.sendTaskDueNotification(userId, task.title, 1);
                    await prisma.task.update({
                        where: { id: task.id },
                        data: { notified1h: true }
                    });
                }
            }
        }
    }
}

export const reminderJob = new ReminderJob();
