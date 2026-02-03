import { prisma } from '../server.js';
import { classroomService } from '../services/classroom.service.js';
import { notificationService } from '../services/notification.service.js';

class SyncJob {
    async run() {
        // Get all users with active Google connections
        const connections = await prisma.googleClassroomConnection.findMany({
            where: {
                syncEnabled: true,
                accessToken: { not: '' } // Only users with OAuth (not email-only)
            },
            include: {
                user: {
                    select: { id: true, email: true }
                }
            }
        });

        console.log(`[SYNC] Processing ${connections.length} users...`);

        for (const connection of connections) {
            try {
                // Sync courses first
                await classroomService.syncCourses(connection.userId);

                // Check for new tasks
                const result = await classroomService.checkForNewTasks(connection.userId);

                if (result.hasNew) {
                    console.log(`[SYNC] Found ${result.count} new tasks for user ${connection.user.email}`);

                    // Get the new tasks to send notifications
                    const newTasks = await prisma.task.findMany({
                        where: {
                            userId: connection.userId,
                            isFromClassroom: true,
                            createdAt: {
                                gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
                            }
                        },
                        include: {
                            course: true
                        }
                    });

                    // Send notification for each new task
                    for (const task of newTasks) {
                        await notificationService.sendNewTaskNotification(
                            connection.userId,
                            task.title,
                            task.course?.name
                        );
                    }
                }

                // Update last sync time
                await prisma.googleClassroomConnection.update({
                    where: { id: connection.id },
                    data: { lastSyncAt: new Date() }
                });
            } catch (error) {
                console.error(`[SYNC] Error syncing user ${connection.user.email}:`, error);
            }
        }
    }
}

export const syncJob = new SyncJob();
