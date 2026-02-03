import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler, AppError } from '../middleware/error.middleware.js';

const router = Router();

// POST /api/notifications/register-token
router.post('/register-token', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const schema = z.object({
        token: z.string().min(1, 'Token is required'),
        platform: z.enum(['ios', 'android'])
    });

    const data = schema.parse(req.body);

    // Upsert the token
    await prisma.pushToken.upsert({
        where: { token: data.token },
        update: { userId: req.userId!, isActive: true },
        create: {
            token: data.token,
            platform: data.platform,
            userId: req.userId!
        }
    });

    res.json({ success: true });
}));

// DELETE /api/notifications/unregister-token
router.delete('/unregister-token', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const { token } = req.body;

    if (token) {
        await prisma.pushToken.updateMany({
            where: { token },
            data: { isActive: false }
        });
    } else {
        // Unregister all tokens for the user
        await prisma.pushToken.updateMany({
            where: { userId: req.userId },
            data: { isActive: false }
        });
    }

    res.json({ success: true });
}));

// GET /api/notifications/preferences
router.get('/preferences', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    let prefs = await prisma.notificationPreference.findUnique({
        where: { userId: req.userId }
    });

    // Create default preferences if not exist
    if (!prefs) {
        prefs = await prisma.notificationPreference.create({
            data: { userId: req.userId! }
        });
    }

    res.json(prefs);
}));

// PUT /api/notifications/preferences
router.put('/preferences', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const schema = z.object({
        newTasksEnabled: z.boolean().optional(),
        classRemindersEnabled: z.boolean().optional(),
        classReminderMinutes: z.number().min(5).max(60).optional(),
        gymRemindersEnabled: z.boolean().optional(),
        propedeuticoEnabled: z.boolean().optional(),
        taskDue24hEnabled: z.boolean().optional(),
        taskDue1hEnabled: z.boolean().optional(),
        quietHoursEnabled: z.boolean().optional(),
        quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
        quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable()
    });

    const data = schema.parse(req.body);

    const prefs = await prisma.notificationPreference.upsert({
        where: { userId: req.userId },
        update: data,
        create: {
            userId: req.userId!,
            ...data
        }
    });

    res.json(prefs);
}));

// POST /api/notifications/test - Send a test notification
router.post('/test', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const tokens = await prisma.pushToken.findMany({
        where: { userId: req.userId, isActive: true }
    });

    if (tokens.length === 0) {
        throw new AppError('No active push tokens found', 400);
    }

    // Import notification service
    const { notificationService } = await import('../services/notification.service.js');

    await notificationService.sendToUser(req.userId!, {
        title: '🔔 Test Notification',
        body: 'This is a test notification from Gestión de Tiempo!',
        data: { type: 'test' }
    });

    res.json({ success: true, tokenCount: tokens.length });
}));

export default router;
