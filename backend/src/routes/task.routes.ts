import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler, AppError } from '../middleware/error.middleware.js';
import { aiService } from '../services/ai.service.js';

const router = Router();

const taskSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    dueDate: z.string().datetime().optional(),
    courseId: z.string().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SUBMITTED', 'LATE']).optional()
});

// GET /api/tasks - List all tasks
router.get('/', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const { status, courseId, date, search } = req.query;

    const where: any = { userId: req.userId };

    if (status) {
        where.status = status;
    }

    if (courseId) {
        where.courseId = courseId;
    }

    if (date === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        where.dueDate = { gte: today, lt: tomorrow };
    } else if (date === 'upcoming') {
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        where.dueDate = { gte: today, lt: nextWeek };
    }

    if (search) {
        where.OR = [
            { title: { contains: search as string, mode: 'insensitive' } },
            { description: { contains: search as string, mode: 'insensitive' } }
        ];
    }

    const tasks = await prisma.task.findMany({
        where,
        include: {
            course: {
                select: { id: true, name: true, color: true }
            }
        },
        orderBy: [
            { dueDate: 'asc' },
            { priority: 'desc' },
            { createdAt: 'desc' }
        ]
    });

    res.json(tasks);
}));

// GET /api/tasks/:id
router.get('/:id', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const task = await prisma.task.findFirst({
        where: { id: req.params.id, userId: req.userId },
        include: {
            course: true
        }
    });

    if (!task) {
        throw new AppError('Task not found', 404);
    }

    res.json(task);
}));

// POST /api/tasks - Create manual task
router.post('/', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const data = taskSchema.parse(req.body);

    const task = await prisma.task.create({
        data: {
            ...data,
            dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
            userId: req.userId!,
            isFromClassroom: false
        },
        include: {
            course: {
                select: { id: true, name: true, color: true }
            }
        }
    });

    res.status(201).json(task);
}));

// PUT /api/tasks/:id
router.put('/:id', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const data = taskSchema.partial().parse(req.body);

    const existing = await prisma.task.findFirst({
        where: { id: req.params.id, userId: req.userId }
    });

    if (!existing) {
        throw new AppError('Task not found', 404);
    }

    const task = await prisma.task.update({
        where: { id: req.params.id },
        data: {
            ...data,
            dueDate: data.dueDate ? new Date(data.dueDate) : undefined
        },
        include: {
            course: {
                select: { id: true, name: true, color: true }
            }
        }
    });

    res.json(task);
}));

// DELETE /api/tasks/:id
router.delete('/:id', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const existing = await prisma.task.findFirst({
        where: { id: req.params.id, userId: req.userId }
    });

    if (!existing) {
        throw new AppError('Task not found', 404);
    }

    // Don't allow deleting Classroom tasks (they should be marked as completed instead)
    if (existing.isFromClassroom) {
        throw new AppError('Cannot delete Classroom tasks. Mark as completed instead.', 400);
    }

    await prisma.task.delete({ where: { id: req.params.id } });
    res.json({ success: true });
}));

// POST /api/tasks/:id/complete
router.post('/:id/complete', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const existing = await prisma.task.findFirst({
        where: { id: req.params.id, userId: req.userId }
    });

    if (!existing) {
        throw new AppError('Task not found', 404);
    }

    const task = await prisma.task.update({
        where: { id: req.params.id },
        data: {
            status: existing.isFromClassroom ? 'SUBMITTED' : 'COMPLETED'
        }
    });

    res.json(task);
}));

// POST /api/tasks/:id/ai-schedule - Get AI suggested time
router.post('/:id/ai-schedule', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const task = await prisma.task.findFirst({
        where: { id: req.params.id, userId: req.userId },
        include: { course: true }
    });

    if (!task) {
        throw new AppError('Task not found', 404);
    }

    // Get all schedules and other tasks
    const [classes, gym, propedeutico, otherTasks] = await Promise.all([
        prisma.classSchedule.findMany({
            where: { userId: req.userId, isActive: true }
        }),
        prisma.gymSchedule.findMany({
            where: { userId: req.userId, isActive: true }
        }),
        prisma.propedeuticoSchedule.findMany({
            where: { userId: req.userId, isActive: true }
        }),
        prisma.task.findMany({
            where: {
                userId: req.userId,
                id: { not: task.id },
                status: { in: ['PENDING', 'IN_PROGRESS'] },
                suggestedDate: { not: null }
            }
        })
    ]);

    const suggestion = await aiService.suggestTaskTime({
        task,
        schedules: { classes, gym, propedeutico },
        otherTasks
    });

    // Save the suggestion
    if (suggestion.date && suggestion.time) {
        await prisma.task.update({
            where: { id: task.id },
            data: {
                suggestedDate: new Date(suggestion.date),
                suggestedTime: suggestion.time
            }
        });
    }

    res.json(suggestion);
}));

// POST /api/tasks/ai-schedule-all - AI schedule for all pending tasks
router.post('/ai-schedule-all', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const pendingTasks = await prisma.task.findMany({
        where: {
            userId: req.userId,
            status: { in: ['PENDING', 'IN_PROGRESS'] }
        },
        include: { course: true }
    });

    if (pendingTasks.length === 0) {
        return res.json({ suggestions: [] });
    }

    const [classes, gym, propedeutico] = await Promise.all([
        prisma.classSchedule.findMany({
            where: { userId: req.userId, isActive: true }
        }),
        prisma.gymSchedule.findMany({
            where: { userId: req.userId, isActive: true }
        }),
        prisma.propedeuticoSchedule.findMany({
            where: { userId: req.userId, isActive: true }
        })
    ]);

    const suggestions = await aiService.suggestMultipleTaskTimes({
        tasks: pendingTasks,
        schedules: { classes, gym, propedeutico }
    });

    // Save suggestions
    for (const suggestion of suggestions) {
        if (suggestion.date && suggestion.time) {
            await prisma.task.update({
                where: { id: suggestion.taskId },
                data: {
                    suggestedDate: new Date(suggestion.date),
                    suggestedTime: suggestion.time
                }
            });
        }
    }

    res.json({ suggestions });
}));

// GET /api/tasks/stats/summary
router.get('/stats/summary', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [total, pending, completed, dueToday, overdue] = await Promise.all([
        prisma.task.count({ where: { userId: req.userId } }),
        prisma.task.count({
            where: { userId: req.userId, status: { in: ['PENDING', 'IN_PROGRESS'] } }
        }),
        prisma.task.count({
            where: { userId: req.userId, status: { in: ['COMPLETED', 'SUBMITTED'] } }
        }),
        prisma.task.count({
            where: {
                userId: req.userId,
                status: { in: ['PENDING', 'IN_PROGRESS'] },
                dueDate: { gte: today, lt: tomorrow }
            }
        }),
        prisma.task.count({
            where: {
                userId: req.userId,
                status: { in: ['PENDING', 'IN_PROGRESS'] },
                dueDate: { lt: today }
            }
        })
    ]);

    res.json({ total, pending, completed, dueToday, overdue });
}));

export default router;
