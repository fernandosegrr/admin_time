import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler, AppError } from '../middleware/error.middleware.js';

const router = Router();

// ==================== CLASS SCHEDULES ====================

const classScheduleSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    classroom: z.string().optional(),
    teacher: z.string().optional(),
    dayOfWeek: z.number().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (HH:MM)'),
    color: z.string().optional(),
    isActive: z.boolean().optional()
});

// GET /api/schedules/classes
router.get('/classes', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const schedules = await prisma.classSchedule.findMany({
        where: { userId: req.userId },
        include: {
            courses: {
                select: { id: true, name: true, googleCourseId: true }
            }
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }]
    });
    res.json(schedules);
}));

// POST /api/schedules/classes
router.post('/classes', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const data = classScheduleSchema.parse(req.body);

    const schedule = await prisma.classSchedule.create({
        data: {
            ...data,
            userId: req.userId!
        }
    });
    res.status(201).json(schedule);
}));

// PUT /api/schedules/classes/:id
router.put('/classes/:id', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const data = classScheduleSchema.partial().parse(req.body);

    const existing = await prisma.classSchedule.findFirst({
        where: { id: req.params.id, userId: req.userId }
    });

    if (!existing) {
        throw new AppError('Schedule not found', 404);
    }

    const schedule = await prisma.classSchedule.update({
        where: { id: req.params.id },
        data
    });
    res.json(schedule);
}));

// DELETE /api/schedules/classes/:id
router.delete('/classes/:id', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const existing = await prisma.classSchedule.findFirst({
        where: { id: req.params.id, userId: req.userId }
    });

    if (!existing) {
        throw new AppError('Schedule not found', 404);
    }

    await prisma.classSchedule.delete({ where: { id: req.params.id } });
    res.json({ success: true });
}));

// POST /api/schedules/classes/import - Import from JSON
router.post('/classes/import', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const importSchema = z.object({
        clases: z.array(z.object({
            nombre: z.string(),
            diaSemana: z.number().min(0).max(6),
            horaInicio: z.string(),
            horaFin: z.string(),
            color: z.string().optional(),
            aula: z.string().optional(),
            profesor: z.string().optional()
        }))
    });

    const data = importSchema.parse(req.body);

    // Delete existing schedules for this user
    await prisma.classSchedule.deleteMany({
        where: { userId: req.userId }
    });

    // Create new schedules
    const schedules = await prisma.classSchedule.createMany({
        data: data.clases.map(c => ({
            userId: req.userId!,
            name: c.nombre,
            dayOfWeek: c.diaSemana,
            startTime: c.horaInicio,
            endTime: c.horaFin,
            color: c.color || '#4285F4',
            classroom: c.aula,
            teacher: c.profesor
        }))
    });

    res.json({ imported: schedules.count });
}));

// ==================== GYM SCHEDULES ====================

const gymScheduleSchema = z.object({
    name: z.string().optional(),
    location: z.string().optional(),
    dayOfWeek: z.number().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
    color: z.string().optional(),
    isActive: z.boolean().optional()
});

// GET /api/schedules/gym
router.get('/gym', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const schedules = await prisma.gymSchedule.findMany({
        where: { userId: req.userId },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }]
    });
    res.json(schedules);
}));

// POST /api/schedules/gym
router.post('/gym', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const data = gymScheduleSchema.parse(req.body);

    const schedule = await prisma.gymSchedule.create({
        data: {
            ...data,
            userId: req.userId!
        }
    });
    res.status(201).json(schedule);
}));

// PUT /api/schedules/gym/:id
router.put('/gym/:id', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const data = gymScheduleSchema.partial().parse(req.body);

    const existing = await prisma.gymSchedule.findFirst({
        where: { id: req.params.id, userId: req.userId }
    });

    if (!existing) {
        throw new AppError('Schedule not found', 404);
    }

    const schedule = await prisma.gymSchedule.update({
        where: { id: req.params.id },
        data
    });
    res.json(schedule);
}));

// DELETE /api/schedules/gym/:id
router.delete('/gym/:id', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const existing = await prisma.gymSchedule.findFirst({
        where: { id: req.params.id, userId: req.userId }
    });

    if (!existing) {
        throw new AppError('Schedule not found', 404);
    }

    await prisma.gymSchedule.delete({ where: { id: req.params.id } });
    res.json({ success: true });
}));

// POST /api/schedules/gym/:id/skip - Mark a day as skipped
router.post('/gym/:id/skip', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const { date } = req.body; // "YYYY-MM-DD"

    const schedule = await prisma.gymSchedule.findFirst({
        where: { id: req.params.id, userId: req.userId }
    });

    if (!schedule) {
        throw new AppError('Schedule not found', 404);
    }

    const skippedDates = [...schedule.skippedDates];
    if (!skippedDates.includes(date)) {
        skippedDates.push(date);
    }

    await prisma.gymSchedule.update({
        where: { id: req.params.id },
        data: { skippedDates }
    });

    res.json({ success: true });
}));

// POST /api/schedules/gym/:id/unskip - Remove skip from a day
router.post('/gym/:id/unskip', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const { date } = req.body;

    const schedule = await prisma.gymSchedule.findFirst({
        where: { id: req.params.id, userId: req.userId }
    });

    if (!schedule) {
        throw new AppError('Schedule not found', 404);
    }

    const skippedDates = schedule.skippedDates.filter(d => d !== date);

    await prisma.gymSchedule.update({
        where: { id: req.params.id },
        data: { skippedDates }
    });

    res.json({ success: true });
}));

// ==================== PROPEDÉUTICO SCHEDULES ====================

const propedeuticoSchema = z.object({
    name: z.string().optional(),
    location: z.string().optional(),
    description: z.string().optional(),
    dayOfWeek: z.number().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
    color: z.string().optional(),
    isActive: z.boolean().optional()
});

// GET /api/schedules/propedeutico
router.get('/propedeutico', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const schedules = await prisma.propedeuticoSchedule.findMany({
        where: { userId: req.userId },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }]
    });
    res.json(schedules);
}));

// POST /api/schedules/propedeutico
router.post('/propedeutico', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const data = propedeuticoSchema.parse(req.body);

    const schedule = await prisma.propedeuticoSchedule.create({
        data: {
            ...data,
            userId: req.userId!
        }
    });
    res.status(201).json(schedule);
}));

// PUT /api/schedules/propedeutico/:id
router.put('/propedeutico/:id', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const data = propedeuticoSchema.partial().parse(req.body);

    const existing = await prisma.propedeuticoSchedule.findFirst({
        where: { id: req.params.id, userId: req.userId }
    });

    if (!existing) {
        throw new AppError('Schedule not found', 404);
    }

    const schedule = await prisma.propedeuticoSchedule.update({
        where: { id: req.params.id },
        data
    });
    res.json(schedule);
}));

// DELETE /api/schedules/propedeutico/:id
router.delete('/propedeutico/:id', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const existing = await prisma.propedeuticoSchedule.findFirst({
        where: { id: req.params.id, userId: req.userId }
    });

    if (!existing) {
        throw new AppError('Schedule not found', 404);
    }

    await prisma.propedeuticoSchedule.delete({ where: { id: req.params.id } });
    res.json({ success: true });
}));

// ==================== COMBINED VIEW ====================

// GET /api/schedules/all - Get all schedules for a user
router.get('/all', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const [classes, gym, propedeutico] = await Promise.all([
        prisma.classSchedule.findMany({
            where: { userId: req.userId, isActive: true },
            include: { courses: { select: { id: true, name: true } } }
        }),
        prisma.gymSchedule.findMany({
            where: { userId: req.userId, isActive: true }
        }),
        prisma.propedeuticoSchedule.findMany({
            where: { userId: req.userId, isActive: true }
        })
    ]);

    res.json({
        classes: classes.map(c => ({ ...c, type: 'class' })),
        gym: gym.map(g => ({ ...g, type: 'gym' })),
        propedeutico: propedeutico.map(p => ({ ...p, type: 'propedeutico' }))
    });
}));

// GET /api/schedules/day/:dayOfWeek - Get schedules for a specific day
router.get('/day/:dayOfWeek', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const dayOfWeek = parseInt(req.params.dayOfWeek);

    if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        throw new AppError('Invalid day of week', 400);
    }

    const [classes, gym, propedeutico] = await Promise.all([
        prisma.classSchedule.findMany({
            where: { userId: req.userId, dayOfWeek, isActive: true },
            orderBy: { startTime: 'asc' }
        }),
        prisma.gymSchedule.findMany({
            where: { userId: req.userId, dayOfWeek, isActive: true },
            orderBy: { startTime: 'asc' }
        }),
        prisma.propedeuticoSchedule.findMany({
            where: { userId: req.userId, dayOfWeek, isActive: true },
            orderBy: { startTime: 'asc' }
        })
    ]);

    // Combine and sort by start time
    const all = [
        ...classes.map(c => ({ ...c, type: 'class' as const })),
        ...gym.map(g => ({ ...g, type: 'gym' as const })),
        ...propedeutico.map(p => ({ ...p, type: 'propedeutico' as const }))
    ].sort((a, b) => a.startTime.localeCompare(b.startTime));

    res.json(all);
}));

export default router;
