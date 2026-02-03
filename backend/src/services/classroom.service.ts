import { google } from 'googleapis';
import { prisma } from '../server.js';

const SCOPES = [
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
    'https://www.googleapis.com/auth/classroom.announcements.readonly'
];

class ClassroomService {
    private oauth2Client;

    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );
    }

    getAuthUrl(): string {
        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            prompt: 'consent'
        });
    }

    async exchangeCode(code: string) {
        const { tokens } = await this.oauth2Client.getToken(code);
        return tokens;
    }

    private async getAuthenticatedClient(userId: string) {
        const connection = await prisma.googleClassroomConnection.findUnique({
            where: { userId }
        });

        if (!connection) {
            throw new Error('Google not connected');
        }

        if (!connection.accessToken) {
            throw new Error('OAuth not configured');
        }

        this.oauth2Client.setCredentials({
            access_token: connection.accessToken,
            refresh_token: connection.refreshToken,
            expiry_date: connection.tokenExpiry.getTime()
        });

        // Check if token needs refresh
        if (connection.tokenExpiry < new Date()) {
            const { credentials } = await this.oauth2Client.refreshAccessToken();

            await prisma.googleClassroomConnection.update({
                where: { userId },
                data: {
                    accessToken: credentials.access_token!,
                    refreshToken: credentials.refresh_token || connection.refreshToken,
                    tokenExpiry: new Date(credentials.expiry_date || Date.now() + 3600000)
                }
            });

            this.oauth2Client.setCredentials(credentials);
        }

        return google.classroom({ version: 'v1', auth: this.oauth2Client });
    }

    async syncCourses(userId: string) {
        const classroom = await this.getAuthenticatedClient(userId);

        const response = await classroom.courses.list({
            courseStates: ['ACTIVE'],
            pageSize: 100
        });

        const courses = response.data.courses || [];
        const syncedCourses = [];

        for (const course of courses) {
            // Get teacher info
            let teacherName = '';
            try {
                const teacherResponse = await classroom.courses.teachers.list({
                    courseId: course.id!
                });
                const owner = teacherResponse.data.teachers?.find(
                    t => t.userId === course.ownerId
                );
                teacherName = owner?.profile?.name?.fullName || '';
            } catch {
                // Ignore teacher fetch errors
            }

            const synced = await prisma.course.upsert({
                where: {
                    userId_googleCourseId: {
                        userId,
                        googleCourseId: course.id!
                    }
                },
                update: {
                    name: course.name || 'Unnamed Course',
                    section: course.section,
                    description: course.description,
                    teacherName
                },
                create: {
                    userId,
                    googleCourseId: course.id!,
                    name: course.name || 'Unnamed Course',
                    section: course.section,
                    description: course.description,
                    teacherName
                }
            });

            syncedCourses.push(synced);
        }

        return syncedCourses;
    }

    async syncTasks(userId: string) {
        const classroom = await this.getAuthenticatedClient(userId);

        // Get all synced courses for this user
        const courses = await prisma.course.findMany({
            where: { userId, syncEnabled: true }
        });

        const newTasks = [];

        for (const course of courses) {
            try {
                const response = await classroom.courses.courseWork.list({
                    courseId: course.googleCourseId,
                    pageSize: 50,
                    orderBy: 'dueDate desc'
                });

                const coursework = response.data.courseWork || [];

                for (const work of coursework) {
                    // Check if task already exists
                    const existing = await prisma.task.findFirst({
                        where: {
                            userId,
                            googleTaskId: work.id
                        }
                    });

                    if (!existing) {
                        // Parse due date
                        let dueDate: Date | null = null;
                        if (work.dueDate) {
                            dueDate = new Date(
                                work.dueDate.year || 2024,
                                (work.dueDate.month || 1) - 1,
                                work.dueDate.day || 1,
                                work.dueTime?.hours || 23,
                                work.dueTime?.minutes || 59
                            );
                        }

                        const task = await prisma.task.create({
                            data: {
                                userId,
                                title: work.title || 'Untitled Task',
                                description: work.description,
                                isFromClassroom: true,
                                googleTaskId: work.id,
                                courseId: course.id,
                                dueDate,
                                priority: dueDate && dueDate < new Date(Date.now() + 86400000)
                                    ? 'HIGH'
                                    : 'MEDIUM'
                            }
                        });

                        newTasks.push(task);
                    }
                }
            } catch (error) {
                console.error(`Error syncing course ${course.name}:`, error);
            }
        }

        return newTasks;
    }

    async checkForNewTasks(userId: string): Promise<{ hasNew: boolean; count: number }> {
        const before = await prisma.task.count({
            where: { userId, isFromClassroom: true }
        });

        await this.syncTasks(userId);

        const after = await prisma.task.count({
            where: { userId, isFromClassroom: true }
        });

        return {
            hasNew: after > before,
            count: after - before
        };
    }
}

export const classroomService = new ClassroomService();
