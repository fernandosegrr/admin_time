import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../server.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler, AppError } from '../middleware/error.middleware.js';

const router = Router();

// Validation schemas
const registerSchema = z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    name: z.string().min(2, 'Name must be at least 2 characters')
});

const loginSchema = z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(1, 'Password is required')
});

// Generate tokens
const generateTokens = (userId: string) => {
    const jwtSecret = process.env.JWT_SECRET || 'default-secret';
    const accessToken = jwt.sign({ userId }, jwtSecret, { expiresIn: '7d' });
    const refreshToken = jwt.sign({ userId, type: 'refresh' }, jwtSecret, { expiresIn: '30d' });
    return { accessToken, refreshToken };
};

// POST /api/auth/register
router.post('/register', asyncHandler(async (req: AuthRequest, res) => {
    const data = registerSchema.parse(req.body);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
        where: { email: data.email }
    });

    if (existingUser) {
        throw new AppError('Email already registered', 409);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Create user
    const user = await prisma.user.create({
        data: {
            email: data.email,
            password: hashedPassword,
            name: data.name,
            notificationPrefs: {
                create: {} // Create with defaults
            }
        },
        select: {
            id: true,
            email: true,
            name: true,
            createdAt: true
        }
    });

    const tokens = generateTokens(user.id);

    res.status(201).json({
        user,
        ...tokens
    });
}));

// POST /api/auth/login
router.post('/login', asyncHandler(async (req: AuthRequest, res) => {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
        where: { email: data.email },
        include: {
            googleConnection: {
                select: { id: true, googleEmail: true, lastSyncAt: true }
            }
        }
    });

    if (!user) {
        throw new AppError('Invalid email or password', 401);
    }

    const isValidPassword = await bcrypt.compare(data.password, user.password);

    if (!isValidPassword) {
        throw new AppError('Invalid email or password', 401);
    }

    const tokens = generateTokens(user.id);

    res.json({
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            createdAt: user.createdAt,
            googleConnected: !!user.googleConnection
        },
        ...tokens
    });
}));

// POST /api/auth/refresh
router.post('/refresh', asyncHandler(async (req: AuthRequest, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        throw new AppError('Refresh token required', 400);
    }

    const jwtSecret = process.env.JWT_SECRET || 'default-secret';

    try {
        const decoded = jwt.verify(refreshToken, jwtSecret) as { userId: string; type: string };

        if (decoded.type !== 'refresh') {
            throw new AppError('Invalid token type', 401);
        }

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId }
        });

        if (!user) {
            throw new AppError('User not found', 401);
        }

        const tokens = generateTokens(user.id);
        res.json(tokens);
    } catch {
        throw new AppError('Invalid refresh token', 401);
    }
}));

// GET /api/auth/me
router.get('/me', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
            googleConnection: {
                select: {
                    id: true,
                    googleEmail: true,
                    lastSyncAt: true,
                    syncEnabled: true
                }
            },
            notificationPrefs: true
        }
    });

    res.json(user);
}));

// PUT /api/auth/profile
router.put('/profile', authMiddleware, asyncHandler(async (req: AuthRequest, res) => {
    const updateSchema = z.object({
        name: z.string().min(2).optional(),
        email: z.string().email().optional(),
        currentPassword: z.string().optional(),
        newPassword: z.string().min(6).optional()
    });

    const data = updateSchema.parse(req.body);

    // If changing password, verify current password
    if (data.newPassword) {
        if (!data.currentPassword) {
            throw new AppError('Current password required', 400);
        }

        const user = await prisma.user.findUnique({ where: { id: req.userId } });
        const isValid = await bcrypt.compare(data.currentPassword, user!.password);

        if (!isValid) {
            throw new AppError('Current password is incorrect', 401);
        }
    }

    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email;
    if (data.newPassword) updateData.password = await bcrypt.hash(data.newPassword, 12);

    const user = await prisma.user.update({
        where: { id: req.userId },
        data: updateData,
        select: {
            id: true,
            email: true,
            name: true,
            createdAt: true
        }
    });

    res.json(user);
}));

export default router;
