import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler, AppError } from '../middleware/error.middleware.js';
import { classroomService } from '../services/classroom.service.js';

const router = Router();

// POST /api/google/connect - Connect Google account (OAuth or email-only)
router.post('/connect', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const schema = z.object({
        // For schools with blocked OAuth - just store email
        googleEmail: z.string().email().optional(),
        // For full OAuth flow
        authCode: z.string().optional()
    });

    const data = schema.parse(req.body);

    if (!data.googleEmail && !data.authCode) {
        throw new AppError('Either googleEmail or authCode is required', 400);
    }

    // Check if already connected
    const existing = await prisma.googleClassroomConnection.findUnique({
        where: { userId: req.userId }
    });

    if (existing) {
        throw new AppError('Google account already connected. Disconnect first.', 409);
    }

    if (data.googleEmail) {
        // Simple email-only connection for schools with blocked OAuth
        await prisma.googleClassroomConnection.create({
            data: {
                userId: req.userId!,
                googleEmail: data.googleEmail,
                accessToken: '', // Empty for email-only mode
                refreshToken: '',
                tokenExpiry: new Date(0),
                syncEnabled: false // Manual sync only in email-only mode
            }
        });

        res.json({
            success: true,
            mode: 'email-only',
            message: 'Google email connected. Manual task entry will be used.'
        });
    } else if (data.authCode) {
        // Full OAuth flow
        try {
            const tokens = await classroomService.exchangeCode(data.authCode);

            await prisma.googleClassroomConnection.create({
                data: {
                    userId: req.userId!,
                    accessToken: tokens.access_token!,
                    refreshToken: tokens.refresh_token!,
                    tokenExpiry: new Date(Date.now() + (tokens.expiry_date || 3600000)),
                    syncEnabled: true
                }
            });

            // Initial sync of courses
            const courses = await classroomService.syncCourses(req.userId!);

            res.json({
                success: true,
                mode: 'oauth',
                coursesImported: courses.length
            });
        } catch (error: any) {
            throw new AppError(`Failed to connect Google: ${error.message}`, 400);
        }
    }
}));

// GET /api/google/auth-url - Get OAuth URL
router.get('/auth-url', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const url = classroomService.getAuthUrl();
    res.json({ url });
}));

// POST /api/google/disconnect
router.post('/disconnect', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    await prisma.googleClassroomConnection.deleteMany({
        where: { userId: req.userId }
    });

    // Also remove courses and their links
    await prisma.course.deleteMany({
        where: { userId: req.userId }
    });

    res.json({ success: true });
}));

// POST /api/google/sync - Manual sync
router.post('/sync', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const connection = await prisma.googleClassroomConnection.findUnique({
        where: { userId: req.userId }
    });

    if (!connection) {
        throw new AppError('Google not connected', 400);
    }

    if (!connection.accessToken) {
        throw new AppError('OAuth not configured. Email-only mode does not support sync.', 400);
    }

    // Sync courses and tasks
    const courses = await classroomService.syncCourses(req.userId!);
    const newTasks = await classroomService.syncTasks(req.userId!);

    // Update last sync time
    await prisma.googleClassroomConnection.update({
        where: { userId: req.userId },
        data: { lastSyncAt: new Date() }
    });

    res.json({
        success: true,
        coursesUpdated: courses.length,
        newTasks: newTasks.length,
        syncedAt: new Date().toISOString()
    });
}));

// GET /api/google/courses - List synced courses
router.get('/courses', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const courses = await prisma.course.findMany({
        where: { userId: req.userId },
        include: {
            classSchedule: {
                select: { id: true, name: true }
            },
            _count: {
                select: { tasks: true }
            }
        },
        orderBy: { name: 'asc' }
    });

    res.json(courses);
}));

// PUT /api/google/courses/:id - Update course settings
router.put('/courses/:id', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const schema = z.object({
        syncEnabled: z.boolean().optional(),
        color: z.string().optional(),
        classScheduleId: z.string().nullable().optional()
    });

    const data = schema.parse(req.body);

    const course = await prisma.course.findFirst({
        where: { id: req.params.id, userId: req.userId }
    });

    if (!course) {
        throw new AppError('Course not found', 404);
    }

    const updated = await prisma.course.update({
        where: { id: req.params.id },
        data
    });

    res.json(updated);
}));

// GET /api/google/status - Connection status
router.get('/status', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const connection = await prisma.googleClassroomConnection.findUnique({
        where: { userId: req.userId }
    });

    if (!connection) {
        res.json({ connected: false });
        return;
    }

    const coursesCount = await prisma.course.count({
        where: { userId: req.userId }
    });

    res.json({
        connected: true,
        mode: connection.accessToken ? 'oauth' : 'email-only',
        googleEmail: connection.googleEmail,
        lastSyncAt: connection.lastSyncAt,
        syncEnabled: connection.syncEnabled,
        coursesCount
    });
}));

export default router;
